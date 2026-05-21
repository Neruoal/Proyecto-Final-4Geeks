import os
import jwt
import datetime
import requests
from functools import wraps
from flask import Flask, request, jsonify, url_for, Blueprint
from api.models import db, User, Favorite, Wallet
from api.utils import generate_sitemap, APIException
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
ALPHA_VANTAGE_KEY = "TU_API_KEY" # reemplazá con tu key de https://www.alphavantage.co/support/#api-key


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
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, os.environ.get('FLASK_APP_KEY', 'secret_key'), algorithm='HS256')

    return jsonify({'token': token, 'user': user.serialize()}), 200


@api.route('/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    return jsonify(current_user.serialize()), 200


# WALLET


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


# FAVORITOS


@api.route('/favorite', methods=['GET'])
@token_required
def get_favorites(current_user):
    favorites = Favorite.query.filter_by(user_id=current_user.id).all()
    serialized_favorites = [fav.serialize() for fav in favorites]
    return jsonify(serialized_favorites), 200


@api.route('/favorite', methods=['POST'])
@token_required
def create_favorite(current_user):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No se proporcionaron datos"}), 400

    asset_ticker = data.get('asset_ticker')
    asset_name = data.get('asset_name')
    asset_type = data.get('asset_type')

    if not asset_ticker or not asset_name or not asset_type:
        return jsonify({"error": "Falta el identificador (asset_ticker), el nombre (asset_name) o el tipo de activo (asset_type)"}), 400

    already_exists = Favorite.query.filter_by(
        user_id=current_user.id,
        asset_ticker=asset_ticker,
        asset_type=asset_type
    ).first()

    if already_exists:
        return jsonify({"message": "Este activo ya se encuentra en tus favoritos", "favorite": already_exists.serialize()}), 200

    favorite = Favorite(
        user_id=current_user.id,
        asset_ticker=asset_ticker,
        asset_name=asset_name,
        asset_type=asset_type
    )

    try:
        db.session.add(favorite)
        db.session.commit()
        return jsonify({"message": "Favorito creado correctamente", "favorite": favorite.serialize()}), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error al guardar favorito: {str(e)}")
        return jsonify({"error": "Error interno del servidor al guardar el favorito."}), 500


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


# NOTICIAS


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
        params = {
            "language": "es",
            "limit": 10
        }
        data = get_external_news_data("/all", params)

        print("RESPUESTA REAL DE LA API EXTERNA:", data)

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


#  ACCIONES

@api.route('/stocks/quote', methods=['GET'])
def stock_quote():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400
    data = av_get("GLOBAL_QUOTE", ticker)
    q = data.get("Global Quote", {})
    if not q:
        return jsonify({"error": "Sin datos"}), 404
    return jsonify({
        "ticker": q.get("01. symbol"),
        "price": q.get("05. price"),
        "change": q.get("09. change"),
        "change_percent": q.get("10. change percent"),
        "high": q.get("03. high"),
        "low": q.get("04. low"),
        "volume": q.get("06. volume")
    }), 200


@api.route('/stocks/history', methods=['GET'])
def stock_history():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400
    data = av_get("TIME_SERIES_DAILY", ticker, outputsize="compact")
    series = data.get("Time Series (Daily)", {})
    if not series:
        return jsonify({"error": "Sin historial"}), 404
    history = [{"date": d, "open": v["1. open"], "high": v["2. high"],
                "low": v["3. low"], "close": v["4. close"], "volume": v["5. volume"]}
               for d, v in sorted(series.items(), reverse=True)[:30]]
    return jsonify({"ticker": ticker, "history": history}), 200


@api.route('/stocks/recommendation', methods=['GET'])
def stock_recommendation():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400
    data = av_get("TIME_SERIES_DAILY", ticker, outputsize="compact")
    series = data.get("Time Series (Daily)", {})
    if not series:
        return jsonify({"error": "Sin datos"}), 404
    closes = [float(v["4. close"]) for v in series.values()]
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
    return jsonify({"ticker": ticker, "price": last,
                    "change_percent_30d": change_pct,
                    "signal": signal, "reason": reason}), 200

#  FONDOS / ETFs


@api.route('/funds/quote', methods=['GET'])
def fund_quote():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400
    data = av_get("GLOBAL_QUOTE", ticker)
    q = data.get("Global Quote", {})
    if not q:
        return jsonify({"error": "Sin datos"}), 404
    return jsonify({
        "ticker": q.get("01. symbol"),
        "price": q.get("05. price"),
        "change": q.get("09. change"),
        "change_percent": q.get("10. change percent"),
        "high": q.get("03. high"),
        "low": q.get("04. low"),
        "volume": q.get("06. volume")
    }), 200


@api.route('/funds/history', methods=['GET'])
def fund_history():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400
    data = av_get("TIME_SERIES_DAILY", ticker, outputsize="compact")
    series = data.get("Time Series (Daily)", {})
    if not series:
        return jsonify({"error": "Sin historial"}), 404
    history = [{"date": d, "open": v["1. open"], "high": v["2. high"],
                "low": v["3. low"], "close": v["4. close"], "volume": v["5. volume"]}
               for d, v in sorted(series.items(), reverse=True)[:30]]
    return jsonify({"ticker": ticker, "history": history}), 200


@api.route('/funds/recommendation', methods=['GET'])
def fund_recommendation():
    ticker = request.args.get("ticker", "").strip().upper()
    if not ticker:
        return jsonify({"error": "Falta 'ticker'"}), 400
    data = av_get("TIME_SERIES_DAILY", ticker, outputsize="compact")
    series = data.get("Time Series (Daily)", {})
    if not series:
        return jsonify({"error": "Sin datos"}), 404
    closes = [float(v["4. close"]) for v in series.values()]
    first, last = closes[0], closes[-1]
    change_pct = round(((last - first) / first) * 100, 2)
    avg_30 = sum(closes) / len(closes)
    avg_7 = sum(closes[-7:]) / 7 if len(closes) >= 7 else avg_30
    if change_pct > 5 and last > avg_30 and avg_7 > avg_30:
        signal, reason = "COMPRAR", "Tendencia alcista fuerte en el fondo"
    elif change_pct < -5 and last < avg_30 and avg_7 < avg_30:
        signal, reason = "VENDER", "Tendencia bajista fuerte en el fondo"
    elif abs(change_pct) <= 3:
        signal, reason = "MANTENER", "Fondo lateral sin señal clara"
    elif change_pct > 0 and last > avg_30:
        signal, reason = "MANTENER", "Ligera tendencia positiva, monitorear"
    else:
        signal, reason = "MANTENER", "Sin tendencia definida"
    return jsonify({"ticker": ticker, "price": last,
                    "change_percent_30d": change_pct,
                    "signal": signal, "reason": reason}), 200
