import os
import jwt
import datetime as dt
import requests
import json
from functools import wraps
from flask import Flask, request, jsonify, url_for, Blueprint
from api.models import db, User, Favorite, Wallet, MarketCache
from api.utils import generate_sitemap, APIException
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_KEY", "")
NEWS_API_BASE_URL = os.getenv(
    "NEWS_API_BASE_URL", "https://api.marketaux.com/v1/news")
NEWS_API_TOKEN = os.getenv("NEWS_API_TOKEN", "")


def av_get(function: str, symbol: str, **kwargs):
    params = {"function": function, "symbol": symbol,
              "apikey": ALPHA_VANTAGE_KEY}
    params.update(kwargs)
    try:
        r = requests.get("https://www.alphavantage.co/query", params=params)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Error en Alpha Vantage: {e}")


def get_cached_or_fetch(ticker, data_type, fetch_func, ttl_minutes=60):
    cached = MarketCache.query.filter_by(
        ticker=ticker, data_type=data_type).first()
    if cached and not cached.is_expired():
        return json.loads(cached.response_data)
    data = fetch_func()
    response_json = json.dumps(data)
    expires = dt.datetime.utcnow() + dt.timedelta(minutes=ttl_minutes)
    if cached:
        cached.response_data = response_json
        cached.created_at = dt.datetime.utcnow()
        cached.expires_at = expires
    else:
        cached = MarketCache(ticker=ticker, data_type=data_type,
                             response_data=response_json, expires_at=expires)
        db.session.add(cached)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
    return data


def fetch_daily_series(ticker, asset_type="stock"):
    def fetch():
        if asset_type == "crypto":
            data = av_get("DIGITAL_CURRENCY_DAILY", ticker, market="USD")
            return data.get("Time Series (Digital Currency Daily)", {})
        else:
            data = av_get("TIME_SERIES_DAILY", ticker, outputsize="compact")
            return data.get("Time Series (Daily)", {})
    return get_cached_or_fetch(ticker, f"daily_series_{asset_type}", fetch, ttl_minutes=360)


def build_history(ticker, series, asset_type="stock"):
    if not series:
        return {"error": "Sin historial"}
    history = []
    for d, v in sorted(series.items(), reverse=True)[:30]:
        if asset_type == "crypto":
            entry = {"open": None, "high": None, "low": None, "close": None, "volume": None}
            for key, val in v.items():
                k = key.lower()
                if "open" in k: entry["open"] = val
                elif "high" in k: entry["high"] = val
                elif "low" in k: entry["low"] = val
                elif "close" in k: entry["close"] = val
                elif "volume" in k: entry["volume"] = val
            history.append({"date": d, **entry})
        else:
            history.append({
                "date": d,
                "open": v["1. open"],
                "high": v["2. high"],
                "low": v["3. low"],
                "close": v["4. close"],
                "volume": v["5. volume"],
            })
    return {"ticker": ticker, "history": history}


def build_recommendation(ticker, series, asset_type="stock"):
    if not series:
        return {"error": "Sin datos"}
    closes = []
    for v in series.values():
        if asset_type == "crypto":
            for key, val in v.items():
                if "close" in key.lower():
                    closes.append(float(val))
                    break
        else:
            closes.append(float(v["4. close"]))
    if not closes:
        return {"error": "No se pudieron procesar los precios de cierre"}
    first, last = closes[0], closes[-1]
    change_pct = round(((last - first) / first) * 100, 2)
    avg_30 = sum(closes) / len(closes)
    avg_7 = sum(closes[-7:]) / 7 if len(closes) >= 7 else avg_30
    if change_pct > 5 and last > avg_30 and avg_7 > avg_30:
        signal, reason = "COMPRAR", "Tendencia alcista fuerte, precio sobre media 30d y 7d"
    elif change_pct < -5 and last < avg_30 and avg_7 < avg_30:
        signal, reason = "VENDER", "Tendencia bajista fuerte, precio bajo media 30d y 7d"
    elif abs(change_pct) <= 3:
        signal, reason = "MANTENER", "Mercado lateral sin señal clara"
    elif change_pct > 0 and last > avg_30:
        signal, reason = "MANTENER", "Leve tendencia alcista, esperar confirmación"
    else:
        signal, reason = "MANTENER", "Sin suficiente consistencia en la tendencia"
    return {
        "ticker": ticker,
        "price": last,
        "change_percent_30d": change_pct,
        "signal": signal,
        "reason": reason,
    }


api = Blueprint('api', __name__)
CORS(api)


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].replace('Bearer ', '')
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        try:
            data = jwt.decode(token, os.environ.get(
                'FLASK_APP_KEY', 'secret_key'), algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])
        except:
            return jsonify({'message': 'Token is invalid'}), 401
        return f(current_user, *args, **kwargs)
    return decorated


@api.route('/signup', methods=['POST'])
def signup():
    body = request.get_json()
    if not body or not body.get('email') or not body.get('password'):
        return jsonify({'message': 'Email and password are required'}), 400
    if User.query.filter_by(email=body['email']).first():
        return jsonify({'message': 'Email already registered'}), 400
    hashed_password = generate_password_hash(body['password'])
    new_user = User(email=body['email'],
                    password=hashed_password, is_active=True)
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
        'user_id': user.id,
        'email': user.email,
        'exp': dt.datetime.utcnow() + dt.timedelta(hours=24)
    }, os.environ.get('FLASK_APP_KEY', 'secret_key'), algorithm='HS256')
    return jsonify({'token': token, 'user': user.serialize()}), 200


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

    if "full_name" in body:
        current_user.full_name = body["full_name"].strip()
    if "company" in body:
        current_user.company = body["company"].strip()
    if "avatar_url" in body:
        current_user.avatar_url = body["avatar_url"].strip()

    try:
        db.session.commit()
        return jsonify({"message": "Perfil actualizado", "user": current_user.serialize()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@api.route('/wallet', methods=['GET'])
@token_required
def get_user_wallet(current_user):
    user_banks = Wallet.query.filter_by(user_id=current_user.id).all()
    return jsonify([bank.serialize() for bank in user_banks]), 200


@api.route('/wallet', methods=['POST'])
@token_required
def add_bank_to_wallet(current_user):
    body = request.get_json()
    if not body or "bank_name" not in body or "liquidity" not in body:
        return jsonify({"error": "Faltan los campos 'bank_name' y/o 'liquidity'"}), 400
    try:
        bank_name = body["bank_name"].strip().upper()
        liquidity = float(body["liquidity"])
        already_exists = Wallet.query.filter_by(
            user_id=current_user.id, bank_name=bank_name).first()
        if already_exists:
            return jsonify({"error": f"El banco {bank_name} ya está en tu cartera. Usa PUT para modificar su saldo."}), 400
        new_bank = Wallet(user_id=current_user.id,
                          bank_name=bank_name, liquidity=liquidity)
        db.session.add(new_bank)
        db.session.commit()
        return jsonify({"message": "Banco añadido correctamente", "bank": new_bank.serialize()}), 201
    except ValueError:
        return jsonify({"error": "La liquidez debe ser un número válido"}), 400


@api.route('/wallet', methods=['PUT'])
@token_required
def update_bank_liquidity(current_user):
    body = request.get_json()
    if not body or "bank_name" not in body or "liquidity" not in body:
        return jsonify({"error": "Faltan los campos 'bank_name' y/o 'liquidity'"}), 400
    try:
        bank_name = body["bank_name"].strip().upper()
        nuevo_saldo = float(body["liquidity"])
        bank_record = Wallet.query.filter_by(
            user_id=current_user.id, bank_name=bank_name).first()
        if not bank_record:
            return jsonify({"error": f"No se encontró el banco {bank_name} en tu cartera"}), 404
        bank_record.liquidity = nuevo_saldo
        db.session.commit()
        return jsonify({"message": f"Fondos de {bank_name} actualizados", "bank": bank_record.serialize()}), 200
    except ValueError:
        return jsonify({"error": "La liquidez debe ser un número válido"}), 400


@api.route('/wallet/<int:wallet_id>', methods=['DELETE'])
@token_required
def delete_bank_from_wallet(current_user, wallet_id):
    bank_record = Wallet.query.filter_by(
        id=wallet_id, user_id=current_user.id).first()
    if not bank_record:
        return jsonify({"error": "Banco no encontrado en tu cartera"}), 404
    db.session.delete(bank_record)
    db.session.commit()
    return jsonify({"message": f"Banco {bank_record.bank_name} eliminado de la cartera"}), 200


@api.route('/favorite', methods=['GET'])
@token_required
def get_favorites(current_user):
    favorites = Favorite.query.filter_by(user_id=current_user.id).all()
    serialized_favorites = [fav.serialize() for fav in favorites]
    return jsonify(serialized_favorites), 200


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
            "message": f"¡{ticker.upper()} guardado en favoritos como {tipo}!",
            "favorite": {"id": nuevo_favorito.id}
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "No se pudo guardar en favoritos"}), 500


@api.route('/favorite/<int:favorite_id>', methods=['DELETE'])
@token_required
def delete_favorite(current_user, favorite_id):
    favorite = Favorite.query.filter_by(
        id=favorite_id, user_id=current_user.id).first()
    if not favorite:
        return jsonify({"error": "Favorito no encontrado o no estás autorizado"}), 404
    db.session.delete(favorite)
    db.session.commit()
    return jsonify({"message": "Favorito eliminado correctamente"}), 200


def get_external_news_data(endpoint: str, params: dict):
    full_url = f"{NEWS_API_BASE_URL}{endpoint}"
    params['api_token'] = NEWS_API_TOKEN
    try:
        response = requests.get(full_url, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error al conectar con la API de noticias: {e}")
        raise Exception(
            "No se pudo conectar o validar los datos de las noticias externas.")


@api.route('/news', methods=['GET'])
def get_news():
    try:
        params = {"language": "es", "limit": 10}
        data = get_external_news_data("/all", params)
        news_list = []
        for item in data.get("data", []):
            news_list.append({
                "id": item.get("uuid") or f"api_{item.get('id', 'unknown')}",
                "title": item.get("title"),
                "content": item.get("description") or item.get("snippet"),
                "source": item.get("source"),
                "url": item.get("url")
            })
        return jsonify(news_list), 200
    except Exception as e:
        print(f"ERROR EXACTO EN /NEWS: {str(e)}")
        return jsonify({"error": f"No se pudieron cargar las noticias externas. Motivo: {str(e)}"}), 500


@api.route('/stocks/quote', methods=['GET'])
def stock_quote():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400

    def fetch():
        data = av_get("GLOBAL_QUOTE", ticker)
        q = data.get("Global Quote", {})
        if not q:
            return {"error": "Sin datos"}
        return {
            "ticker": q.get("01. symbol"),
            "price": q.get("05. price"),
            "change": q.get("09. change"),
            "change_percent": q.get("10. change percent"),
            "high": q.get("03. high"),
            "low": q.get("04. low"),
            "volume": q.get("06. volume")
        }
    data = get_cached_or_fetch(ticker, "quote", fetch, ttl_minutes=360)
    if "error" in data:
        return jsonify(data), 404
    return jsonify(data), 200


@api.route('/stocks/history', methods=['GET'])
def stock_history():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400
    series = fetch_daily_series(ticker, asset_type="stock")
    data = build_history(ticker, series, asset_type="stock")
    return (jsonify(data), 404) if "error" in data else (jsonify(data), 200)


@api.route('/stocks/recommendation', methods=['GET'])
def stock_recommendation():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400
    series = fetch_daily_series(ticker, asset_type="stock")
    data = build_recommendation(ticker, series, asset_type="stock")
    return (jsonify(data), 404) if "error" in data else (jsonify(data), 200)


@api.route('/funds/quote', methods=['GET'])
def fund_quote():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400

    def fetch():
        data = av_get("GLOBAL_QUOTE", ticker)
        q = data.get("Global Quote", {})
        if not q:
            return {"error": "Sin datos"}
        return {
            "ticker": q.get("01. symbol"),
            "price": q.get("05. price"),
            "change": q.get("09. change"),
            "change_percent": q.get("10. change percent"),
            "high": q.get("03. high"),
            "low": q.get("04. low"),
            "volume": q.get("06. volume")
        }
    data = get_cached_or_fetch(ticker, "quote", fetch, ttl_minutes=360)
    if "error" in data:
        return jsonify(data), 404
    return jsonify(data), 200


@api.route('/funds/history', methods=['GET'])
def fund_history():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400
    series = fetch_daily_series(ticker, asset_type="stock")
    data = build_history(ticker, series, asset_type="stock")
    return (jsonify(data), 404) if "error" in data else (jsonify(data), 200)


@api.route('/funds/recommendation', methods=['GET'])
def fund_recommendation():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400
    series = fetch_daily_series(ticker, asset_type="stock")
    data = build_recommendation(ticker, series, asset_type="stock")
    return (jsonify(data), 404) if "error" in data else (jsonify(data), 200)


@api.route('/crypto/quote', methods=['GET'])
def crypto_quote():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400

    def fetch():
        data = av_get("DIGITAL_CURRENCY_DAILY", ticker, market="USD")
        time_series = data.get("Time Series (Digital Currency Daily)", {})
        if not time_series:
            return {"error": "Sin datos de criptomonedas o límite de API alcanzado"}
        latest_date = next(iter(time_series))
        today_data = time_series[latest_date]
        extracted = {"price": None, "high": None, "low": None, "volume": None}
        for key, value in today_data.items():
            key_lower = key.lower()
            if "close" in key_lower:
                extracted["price"] = value
            elif "high" in key_lower:
                extracted["high"] = value
            elif "low" in key_lower:
                extracted["low"] = value
            elif "volume" in key_lower:
                extracted["volume"] = value
        return {"ticker": ticker, **extracted}
    data = get_cached_or_fetch(ticker, "quote", fetch, ttl_minutes=360)
    if "error" in data:
        return jsonify(data), 404
    return jsonify(data), 200


@api.route('/crypto/history', methods=['GET'])
def crypto_history():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400
    series = fetch_daily_series(ticker, asset_type="crypto")
    data = build_history(ticker, series, asset_type="crypto")
    return (jsonify(data), 404) if "error" in data else (jsonify(data), 200)


@api.route('/crypto/recommendation', methods=['GET'])
def crypto_recommendation():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400
    series = fetch_daily_series(ticker, asset_type="crypto")
    data = build_recommendation(ticker, series, asset_type="crypto")
    return (jsonify(data), 404) if "error" in data else (jsonify(data), 200)

# YAHOO FINANCE

import yfinance as yf

@api.route('/search', methods=['GET'])
def search_ticker():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"error": "Falta el parámetro 'q'"}), 400
    try:
        resultados = yf.Search(q, max_results=8)
        quotes = resultados.quotes
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
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400

    def fetch():
        try:
            t    = yf.Ticker(ticker)
            info = t.info
            return {
                "ticker":          ticker,
                "name":            info.get("longName"),
                "price":           info.get("currentPrice"),
                "change_percent":  round(info.get("regularMarketChangePercent", 0), 2),
                "sector":          info.get("sector"),
                "industry":        info.get("industry"),
                "market_cap":      info.get("marketCap"),
                "pe_ratio":        info.get("trailingPE"),
                "eps":             info.get("trailingEps"),
                "beta":            info.get("beta"),
                "week_52_high":    info.get("fiftyTwoWeekHigh"),
                "week_52_low":     info.get("fiftyTwoWeekLow"),
                "avg_volume":      info.get("averageVolume"),
                "description":     info.get("longBusinessSummary"),
            }
        except Exception as e:
            return {"error": str(e)}

    data = get_cached_or_fetch(ticker, "yf_info", fetch, ttl_minutes=360)
    if "error" in data:
        return jsonify(data), 404
    return jsonify(data), 200


@api.route('/stocks/yf_recommendation', methods=['GET'])
def stock_yf_recommendation():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400

    def fetch():
        try:
            t       = yf.Ticker(ticker)
            info    = t.info
            hist    = t.history(period="1mo")
            if hist.empty:
                return {"error": "Sin historial"}
            closes       = hist["Close"].tolist()
            price        = closes[-1]
            avg_30       = sum(closes) / len(closes)
            avg_7        = sum(closes[-7:]) / 7 if len(closes) >= 7 else avg_30
            change_pct   = round(((closes[-1] - closes[0]) / closes[0]) * 100, 2)
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
                "ticker":            ticker,
                "price":             round(price, 2),
                "change_percent_30d": change_pct,
                "signal":            signal,
                "reason":            reason,
                "sector":            info.get("sector"),
                "market_cap":        info.get("marketCap"),
                "week_52_high":      info.get("fiftyTwoWeekHigh"),
                "week_52_low":       info.get("fiftyTwoWeekLow"),
            }
        except Exception as e:
            return {"error": str(e)}

    data = get_cached_or_fetch(ticker, "yf_recommendation", fetch, ttl_minutes=360)
    if "error" in data:
        return jsonify(data), 404
    return jsonify(data), 200


@api.route('/funds/yf_recommendation', methods=['GET'])
def fund_yf_recommendation():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400

    def fetch():
        try:
            t     = yf.Ticker(ticker)
            info  = t.info
            hist  = t.history(period="1mo")
            if hist.empty:
                return {"error": "Sin historial"}
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
                "ticker":             ticker,
                "price":              round(price, 2),
                "change_percent_30d": change_pct,
                "signal":             signal,
                "reason":             reason,
                "sector":             info.get("category") or info.get("sector"),
                "market_cap":         info.get("totalAssets") or info.get("marketCap"),
                "week_52_high":       info.get("fiftyTwoWeekHigh"),
                "week_52_low":        info.get("fiftyTwoWeekLow"),
            }
        except Exception as e:
            return {"error": str(e)}

    data = get_cached_or_fetch(ticker, "yf_recommendation", fetch, ttl_minutes=360)
    if "error" in data:
        return jsonify(data), 404
    return jsonify(data), 200


@api.route('/crypto/yf_recommendation', methods=['GET'])
def crypto_yf_recommendation():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400

    def fetch():
        try:
            yf_ticker = ticker if "-" in ticker else f"{ticker}-USD"
            t     = yf.Ticker(yf_ticker)
            info  = t.info
            hist  = t.history(period="1mo")
            if hist.empty:
                return {"error": "Sin historial"}
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
                "ticker":             yf_ticker,
                "price":              round(price, 2),
                "change_percent_30d": change_pct,
                "signal":             signal,
                "reason":             reason,
                "sector":             "Cryptocurrency",
                "market_cap":         info.get("marketCap"),
                "week_52_high":       info.get("fiftyTwoWeekHigh"),
                "week_52_low":        info.get("fiftyTwoWeekLow"),
            }
        except Exception as e:
            return {"error": str(e)}

    data = get_cached_or_fetch(ticker, "yf_crypto_rec", fetch, ttl_minutes=360)
    if "error" in data:
        return jsonify(data), 404
    return jsonify(data), 200