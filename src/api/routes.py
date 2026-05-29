import os
import jwt
import datetime as dt
import requests
import json
import re
from functools import wraps
from dotenv import load_dotenv
from flask import Flask, request, jsonify, url_for, Blueprint
from api.models import db, User, Favorite, Wallet, MarketCache
from api.utils import generate_sitemap, APIException
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import yfinance as yf
from google import genai

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "").strip()
NEWS_API_BASE_URL = os.getenv("NEWS_API_BASE_URL", "https://api.marketaux.com/v1/news")
NEWS_API_TOKEN = os.getenv("NEWS_API_TOKEN", "")

print("============== DIAGNÓSTICO DE IA ==============")
print(f"¿La API Key está vacía?: {GOOGLE_API_KEY == ''}")
print(f"Longitud de la API Key detectada: {len(GOOGLE_API_KEY)} caracteres")
print("===============================================")

api = Blueprint('api', __name__)
CORS(api)

def get_client():
    return genai.Client(api_key=GOOGLE_API_KEY)


# ── DECORADORES Y UTILS ───────────────────────────────────────────────────────

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].replace('Bearer ', '')
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        try:
            data = jwt.decode(token, os.environ.get('FLASK_APP_KEY', 'secret_key'), algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])
            if not current_user:
                return jsonify({'message': 'User not found'}), 401
        except Exception:
            return jsonify({'message': 'Token is invalid'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# ── SISTEMA DE CACHÉ CENTRALIZADO ─────────────────────────────────────────────

def get_market_data(ticker, data_type, fetch_func, ttl_minutes=360):
    """
    Gestiona el caché para cualquier llamada a Yahoo Finance.
    """
    cached = MarketCache.query.filter_by(ticker=ticker, data_type=data_type).first()
    
    if cached and not cached.is_expired():
        return json.loads(cached.response_data)
    
    data = fetch_func()
    
    if "error" in data:
        return data
        
    response_json = json.dumps(data)
    expires = dt.datetime.utcnow() + dt.timedelta(minutes=ttl_minutes)
    
    if cached:
        cached.response_data = response_json
        cached.created_at = dt.datetime.utcnow()
        cached.expires_at = expires
    else:
        new_cache = MarketCache(ticker=ticker, data_type=data_type, 
                                response_data=response_json, expires_at=expires)
        db.session.add(new_cache)
    
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        
    return data

# ── FUNCIÓN DE CÁLCULO ESTÁNDAR PARA YAHOO ───────────────────────────────────

def calculate_yf_metrics(ticker, hist):
    """Lógica unificada para calcular señales basadas en histórico de Yahoo"""
    closes = hist["Close"].tolist()
    price = float(closes[-1])
    avg_30 = sum(closes) / len(closes)
    avg_7 = sum(closes[-7:]) / 7
    change_pct = round(((closes[-1] - closes[0]) / closes[0]) * 100, 2)
    
    if change_pct > 5 and price > avg_30 and avg_7 > avg_30:
        signal, reason = "COMPRAR", "Tendencia alcista fuerte, precio sobre media 30d y 7d"
    elif change_pct < -5 and price < avg_30 and avg_7 < avg_30:
        signal, reason = "VENDER", "Tendencia bajista fuerte, precio bajo media 30d y 7d"
    elif abs(change_pct) <= 3:
        signal, reason = "MANTENER", "Mercado lateral sin señal clara"
    else:
        signal, reason = "MANTENER", "Leve tendencia o sin consistencia clara"
        
    return {
        "ticker": ticker, "price": round(price, 2), "change_percent_30d": change_pct,
        "signal": signal, "reason": reason
    }


# ── AUTH ─────────────────────────────────────────────────────────────────────

@api.route('/signup', methods=['POST'])
def signup():
    body = request.get_json()
    if not body or not body.get('email') or not body.get('password'):
        return jsonify({'message': 'Email and password are required'}), 400
    if User.query.filter_by(email=body['email']).first():
        return jsonify({'message': 'Email already registered'}), 400
    hashed_password = generate_password_hash(body['password'])
    new_user = User(email=body['email'], password=hashed_password, is_active=True)
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'message': 'User created successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Error creating user: {str(e)}'}), 500


@api.route('/login', methods=['POST'])
def login():
    body = request.get_json()
    if not body or not body.get('email') or not body.get('password'):
        return jsonify({'message': 'Email and password are required'}), 400
    user = User.query.filter_by(email=body['email']).first()
    if not user or not check_password_hash(user.password, body['password']):
        return jsonify({'message': 'Invalid email or password'}), 401
    token = jwt.encode({
        'user_id': user.id, 'email': user.email,
        'exp': dt.datetime.utcnow() + dt.timedelta(hours=24)
    }, os.environ.get('FLASK_APP_KEY', 'secret_key'), algorithm='HS256')
    return jsonify({'token': token, 'user': user.serialize()}), 200


# ── PROFILE ───────────────────────────────────────────────────────────────────

@api.route('/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    return jsonify(current_user.serialize()), 200


@api.route('/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    body = request.get_json()
    if not body:
        return jsonify({"error": "No se proporcionaron datos"}), 400
    if "full_name"  in body: current_user.full_name  = body["full_name"].strip()
    if "company"    in body: current_user.company    = body["company"].strip()
    if "avatar_url" in body: current_user.avatar_url = body["avatar_url"].strip()
    try:
        db.session.commit()
        return jsonify({"message": "Perfil actualizado", "user": current_user.serialize()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    

# ── IA ────────────────────────────────────────────────────────────────────────

@api.route('/ask-ai', methods=['POST'])
@token_required
def ask_ai(current_user):
    data = request.get_json()
    
    if not data or "question" not in data:
        return jsonify({"message": "La pregunta es obligatoria"}), 400

    pregunta = data.get("question")
    ticker = data.get("ticker", "").strip().upper()

    print("TICKER RECIBIDO:", ticker)

    # ── YAHOO CONTEXTO ───────────────────────────
    contexto_yahoo = ""

    if ticker:
        try:
            t = yf.Ticker(ticker)
            hist = t.history(period="5d")

            price = None
            if not hist.empty:
                price = float(hist["Close"].iloc[-1])

            info = {}
            try:
                info = t.info or {}
            except:
                info = {}

            print("INFO KEYS:", list(info.keys()) if info else [])
            print("PRICE (history):", price)

            if not price:
                contexto_yahoo = f"[SIN DATOS DE PRECIO PARA {ticker}]"
            else:
                contexto_yahoo = f"""
DATOS YAHOO FINANCE PARA {ticker}
Nombre: {info.get('longName', ticker)}
Precio actual: {price}
Sector: {info.get('sector', 'N/A')}
Resumen: {(info.get('longBusinessSummary') or '')[:300]}
"""

        except Exception as e:
            print("ERROR YAHOO:", e)
            contexto_yahoo = f"[ERROR YAHOO FINANCE: {str(e)}]"

    print("=== CONTEXTO FINAL ===")
    print(contexto_yahoo)

    prompt_completo = f"""
Eres un analista financiero tipo terminal de trading.

REGLAS:
- Usa los datos proporcionados como base
- Puedes completar con conocimiento general del mercado
- No inventes números
- No bloquees la respuesta por falta de datos
- Siempre da una recomendación útil-
- Responde como una persona normal, no como una IA.
- maximo 8 lineas de respuesta, se breve y directo al punto.

DATOS:
{contexto_yahoo}

PREGUNTA:
{pregunta}
"""
    
    try:
        client = get_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt_completo
        )
        return jsonify({"answer": response.text}), 200

    except Exception as e:
        print(f"Error generando respuesta de IA: {e}")
        return jsonify({
            "error": f"Error al procesar tu consulta con la IA: {str(e)}"
        }), 500
        
    

# ── SECCIÓN: WALLET (GESTIÓN DE BANCOS) ───────────────────────────────────────

@api.route('/wallet', methods=['GET'])
@token_required
def get_wallet(current_user):
    banks = Wallet.query.filter_by(user_id=current_user.id).all()
    return jsonify([b.serialize() for b in banks]), 200


@api.route('/wallet', methods=['POST'])
@token_required
def add_bank(current_user):
    data = request.get_json()
    bank_name = data.get("bank_name", "").strip().upper()
    liquidity = data.get("liquidity")

    if not bank_name or liquidity is None:
        return jsonify({"error": "Faltan datos"}), 400
    
    new_bank = Wallet(user_id=current_user.id, bank_name=bank_name, liquidity=float(liquidity))
    db.session.add(new_bank)
    db.session.commit()
    return jsonify({"message": "Banco añadido", "bank": new_bank.serialize()}), 201


@api.route('/wallet', methods=['PUT'])
@token_required
def update_bank(current_user):
    data = request.get_json()
    bank_name = data.get("bank_name", "").strip().upper()
    new_liquidity = data.get("liquidity")

    if not bank_name or new_liquidity is None:
        return jsonify({"error": "Faltan datos"}), 400

    bank = Wallet.query.filter_by(user_id=current_user.id, bank_name=bank_name).first()
    if not bank:
        return jsonify({"error": "Banco no encontrado"}), 404
    
    bank.liquidity = float(new_liquidity)
    db.session.commit()
    return jsonify({"message": "Saldo actualizado", "bank": bank.serialize()}), 200


@api.route('/wallet/<int:id>', methods=['DELETE'])
@token_required
def delete_bank(current_user, id):
    bank = Wallet.query.filter_by(id=id, user_id=current_user.id).first()
    
    if not bank:
        return jsonify({"error": "Banco no encontrado o no autorizado"}), 404
    
    db.session.delete(bank)
    db.session.commit()
    
    return jsonify({"message": f"Banco eliminado correctamente"}), 200


# ── FAVORITOS ─────────────────────────────────────────────────────────────────

@api.route('/favorite', methods=['GET'])
@token_required
def get_favorites(current_user):
    favorites = Favorite.query.filter_by(user_id=current_user.id).all()
    return jsonify([fav.serialize() for fav in favorites]), 200


@api.route('/favorite/<string:tipo>/<string:ticker>', methods=['POST'])
@token_required
def add_favorite(current_user, tipo, ticker):
    nuevo_favorito = Favorite(
        user_id=current_user.id,
        asset_ticker=ticker.upper(),
        asset_name=ticker.upper(),
        asset_type=tipo.lower()
    )
    try:
        db.session.add(nuevo_favorito)
        db.session.commit()
        return jsonify({
            "message":  f"¡{ticker.upper()} guardado en favoritos como {tipo}!",
            "favorite": {"id": nuevo_favorito.id}
        }), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se pudo guardar en favoritos"}), 500


@api.route('/favorite/<int:favorite_id>', methods=['DELETE'])
@token_required
def delete_favorite(current_user, favorite_id):
    favorite = Favorite.query.filter_by(id=favorite_id, user_id=current_user.id).first()
    if not favorite:
        return jsonify({"error": "Favorito no encontrado o no estás autorizado"}), 404
    db.session.delete(favorite)
    db.session.commit()
    return jsonify({"message": "Favorito eliminado correctamente"}), 200


# ── NOTICIAS ──────────────────────────────────────────────────────────────────

def get_external_news_data(endpoint: str, params: dict):
    full_url = f"{NEWS_API_BASE_URL}{endpoint}"
    params['api_token'] = NEWS_API_TOKEN
    try:
        response = requests.get(full_url, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise Exception("No se pudo conectar con la API de noticias.")


@api.route('/news', methods=['GET'])
def get_news():
    try:
        params = {"language": "es", "limit": 10}
        data   = get_external_news_data("/all", params)
        news_list = []
        for item in data.get("data", []):
            news_list.append({
                "id":      item.get("uuid") or f"api_{item.get('id', 'unknown')}",
                "title":   item.get("title"),
                "content": item.get("description") or item.get("snippet"),
                "source":  item.get("source"),
                "url":     item.get("url")
            })
        return jsonify(news_list), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── YAHOO FINANCE ─────────────────────────────────────────────────────────────

@api.route('/search', methods=['GET'])
def search_ticker():
    q = request.args.get("q", "").strip()
    if not q: return jsonify({"error": "Falta el parámetro 'q'"}), 400
    try:
        resultados = yf.Search(q, max_results=8)
        quotes     = resultados.quotes
        return jsonify([{
            "ticker": r.get("symbol"),
            "name":   r.get("longname") or r.get("shortname"),
            "type":   r.get("quoteType", "").lower(),
        } for r in quotes if r.get("symbol")]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api.route('/stocks/info', methods=['GET'])
def stock_info():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker: return jsonify({"error": "Falta 'ticker'"}), 400
    def fetch():
        try:
            t    = yf.Ticker(ticker)
            info = t.info
            return {
                "ticker": ticker, "name": info.get("longName"),
                "price": info.get("currentPrice"),
                "change_percent": round(info.get("regularMarketChangePercent", 0), 2),
                "sector": info.get("sector"), "industry": info.get("industry"),
                "market_cap": info.get("marketCap"), "pe_ratio": info.get("trailingPE"),
                "eps": info.get("trailingEps"), "beta": info.get("beta"),
                "week_52_high": info.get("fiftyTwoWeekHigh"),
                "week_52_low":  info.get("fiftyTwoWeekLow"),
                "avg_volume":   info.get("averageVolume"),
                "description":  info.get("longBusinessSummary"),
            }
        except Exception as e:
            return {"error": str(e)}
    data = get_market_data(ticker, "yf_info", fetch, ttl_minutes=360)
    return (jsonify(data), 404) if "error" in data else (jsonify(data), 200)


@api.route('/stocks/yf_recommendation', methods=['GET'])
def stock_yf_recommendation():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker: return jsonify({"error": "Falta 'ticker'"}), 400
    def fetch():
        try:
            t          = yf.Ticker(ticker)
            info       = t.info
            hist       = t.history(period="1mo")
            if hist.empty: return {"error": "Sin historial"}
            closes     = hist["Close"].tolist()
            price      = closes[-1]
            avg_30     = sum(closes) / len(closes)
            avg_7      = sum(closes[-7:]) / 7 if len(closes) >= 7 else avg_30
            change_pct = round(((closes[-1] - closes[0]) / closes[0]) * 100, 2)
            if change_pct > 5 and price > avg_30 and avg_7 > avg_30:
                signal, reason = "COMPRAR", "Tendencia alcista fuerte, precio sobre media 30d y 7d"
            elif change_pct < -5 and price < avg_30 and avg_7 < avg_30:
                signal, reason = "VENDER", "Tendencia bajista fuerte, precio bajo media 30d y 7d"
            elif abs(change_pct) <= 3:
                signal, reason = "MANTENER", "Mercado lateral sin señal clara"
            elif change_pct > 0 and price > avg_30:
                signal, reason = "MANTENER", "Leve tendencia alcista, esperar confirmación"
            else:
                signal, reason = "MANTENER", "Sin suficiente consistencia en la tendencia"
            return {
                "ticker": ticker, "price": round(price, 2),
                "change_percent_30d": change_pct, "signal": signal, "reason": reason,
                "sector": info.get("sector"), "market_cap": info.get("marketCap"),
                "week_52_high": info.get("fiftyTwoWeekHigh"),
                "week_52_low":  info.get("fiftyTwoWeekLow"),
            }
        except Exception as e:
            return {"error": str(e)}
    data = get_market_data(ticker, "yf_recommendation", fetch, ttl_minutes=360)
    return (jsonify(data), 404) if "error" in data else (jsonify(data), 200)


@api.route('/funds/yf_recommendation', methods=['GET'])
def fund_yf_recommendation():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker: return jsonify({"error": "Falta 'ticker'"}), 400
    def fetch():
        try:
            t          = yf.Ticker(ticker)
            info       = t.info
            hist       = t.history(period="1mo")
            if hist.empty: return {"error": "Sin historial"}
            closes     = hist["Close"].tolist()
            price      = closes[-1]
            avg_30     = sum(closes) / len(closes)
            avg_7      = sum(closes[-7:]) / 7 if len(closes) >= 7 else avg_30
            change_pct = round(((closes[-1] - closes[0]) / closes[0]) * 100, 2)
            if change_pct > 5 and price > avg_30 and avg_7 > avg_30:
                signal, reason = "COMPRAR", "Tendencia alcista fuerte, precio sobre media 30d y 7d"
            elif change_pct < -5 and price < avg_30 and avg_7 < avg_30:
                signal, reason = "VENDER", "Tendencia bajista fuerte, precio bajo media 30d y 7d"
            elif abs(change_pct) <= 3:
                signal, reason = "MANTENER", "Mercado lateral sin señal clara"
            elif change_pct > 0 and price > avg_30:
                signal, reason = "MANTENER", "Leve tendencia alcista, esperar confirmación"
            else:
                signal, reason = "MANTENER", "Sin tendencia definida"
            return {
                "ticker": ticker, "price": round(price, 2),
                "change_percent_30d": change_pct, "signal": signal, "reason": reason,
                "sector":     info.get("category") or info.get("sector"),
                "market_cap": info.get("totalAssets") or info.get("marketCap"),
                "week_52_high": info.get("fiftyTwoWeekHigh"),
                "week_52_low":  info.get("fiftyTwoWeekLow"),
            }
        except Exception as e:
            return {"error": str(e)}
    data = get_market_data(ticker, "yf_recommendation", fetch, ttl_minutes=360)
    return (jsonify(data), 404) if "error" in data else (jsonify(data), 200)


@api.route('/crypto/yf_recommendation', methods=['GET'])
def crypto_yf_recommendation():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker: return jsonify({"error": "Falta 'ticker'"}), 400
    def fetch():
        try:
            yf_ticker  = ticker if "-" in ticker else f"{ticker}-USD"
            t          = yf.Ticker(yf_ticker)
            info       = t.info
            hist       = t.history(period="1mo")
            if hist.empty: return {"error": "Sin historial"}
            closes     = hist["Close"].tolist()
            price      = closes[-1]
            avg_30     = sum(closes) / len(closes)
            avg_7      = sum(closes[-7:]) / 7 if len(closes) >= 7 else avg_30
            change_pct = round(((closes[-1] - closes[0]) / closes[0]) * 100, 2)
            if change_pct > 5 and price > avg_30 and avg_7 > avg_30:
                signal, reason = "COMPRAR", "Tendencia alcista fuerte, precio sobre media 30d y 7d"
            elif change_pct < -5 and price < avg_30 and avg_7 < avg_30:
                signal, reason = "VENDER", "Tendencia bajista fuerte, precio bajo media 30d y 7d"
            elif abs(change_pct) <= 3:
                signal, reason = "MANTENER", "Mercado lateral sin señal clara"
            elif change_pct > 0 and price > avg_30:
                signal, reason = "MANTENER", "Leve tendencia alcista, esperar confirmación"
            else:
                signal, reason = "MANTENER", "Sin tendencia definida"
            return {
                "ticker": yf_ticker, "price": round(price, 2),
                "change_percent_30d": change_pct, "signal": signal, "reason": reason,
                "sector": "Cryptocurrency", "market_cap": info.get("marketCap"),
                "week_52_high": info.get("fiftyTwoWeekHigh"),
                "week_52_low":  info.get("fiftyTwoWeekLow"),
            }
        except Exception as e:
            return {"error": str(e)}
    data = get_market_data(ticker, "yf_crypto_rec", fetch, ttl_minutes=360)
    return (jsonify(data), 404) if "error" in data else (jsonify(data), 200)