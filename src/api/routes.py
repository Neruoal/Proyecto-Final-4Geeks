"""
This module takes care of starting the API Server, Loading the DB and Adding the endpoints
"""
from flask import Flask, request, jsonify, url_for, Blueprint
from api.models import db, User, Fund, ETF, CryptoCurrency, Stock, Favorite, News
from api.utils import generate_sitemap, APIException
from flask_cors import CORS
import os
import jwt
import datetime
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
import requests


NEWS_API_BASE_URL = "https://api.marketaux.com/v1/news"
NEWS_API_TOKEN = "EmoKXw1rPXzgQRbrgpjTNBxJURLumarCc4nkSleq"


api = Blueprint('api', __name__)

# Allow CORS requests to this API
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


@api.route('/hello', methods=['POST', 'GET'])
def handle_hello():

    response_body = {
        "message": "Hello! I'm a message that came from the backend, check the network tab on the google inspector and you will see the GET request"
    }

    return jsonify(response_body), 200


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
    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': 'User created successfully'}), 201


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


# FONDOS


@api.route('/fund', methods=['GET']) 
def get_funds():
    funds = Fund.query.all()
    return jsonify([f.serialize() for f in funds]), 200

@api.route('/fund/<int:fund_id>', methods=['GET']) 
def get_fund(fund_id):
    fund = Fund.query.get(fund_id)
    if not fund:
        return jsonify({"error": "Fund not found"}), 404
    return jsonify(fund.serialize()), 200

@api.route('/fund', methods=['POST'])
def create_fund():
    data = request.get_json()
    if not data or 'name' not in data or 'price' not in data:
        return jsonify({"error": "Missing name or price"}), 400
    fund = Fund(name=data['name'], price=data['price'])
    db.session.add(fund)
    db.session.commit()
    return jsonify(fund.serialize()), 201

@api.route('/fund/<int:fund_id>', methods=['DELETE']) 
def delete_fund(fund_id):
    fund = Fund.query.get(fund_id)
    if not fund:
        return jsonify({"error": "Fund not found"}), 404
    db.session.delete(fund)
    db.session.commit()
    return jsonify({"message": "Fund deleted"}), 200



# ETF


@api.route('/etf', methods=['GET']) 
def get_etfs():
    etfs = ETF.query.all()
    return jsonify([e.serialize() for e in etfs]), 200

@api.route('/etf/<int:etf_id>', methods=['GET']) 
def get_etf(etf_id):
    etf = ETF.query.get(etf_id)
    if not etf:
        return jsonify({"error": "ETF not found"}), 404
    return jsonify(etf.serialize()), 200

@api.route('/etf', methods=['POST'])
def create_etf():
    data = request.get_json()
    if not data or 'name' not in data or 'price' not in data:
        return jsonify({"error": "Missing name or price"}), 400
    etf = ETF(name=data['name'], price=data['price'])
    db.session.add(etf)
    db.session.commit()
    return jsonify(etf.serialize()), 201

@api.route('/etf/<int:etf_id>', methods=['DELETE']) 
def delete_etf(etf_id):
    etf = ETF.query.get(etf_id)
    if not etf:
        return jsonify({"error": "ETF not found"}), 404
    db.session.delete(etf)
    db.session.commit()
    return jsonify({"message": "ETF deleted"}), 200



# CRIPTOMONEDAS


@api.route('/cryptocurrency', methods=['GET'])
def get_cryptos():
    cryptos = CryptoCurrency.query.all()
    return jsonify([c.serialize() for c in cryptos]), 200

@api.route('/cryptocurrency/<int:crypto_id>', methods=['GET'])
def get_crypto(crypto_id):
    crypto = CryptoCurrency.query.get(crypto_id)
    if not crypto:
        return jsonify({"error": "Crypto not found"}), 404
    return jsonify(crypto.serialize()), 200

@api.route('/cryptocurrency', methods=['POST'])
def create_crypto():
    data = request.get_json()
    if not data or 'name' not in data or 'price' not in data:
        return jsonify({"error": "Missing name or price"}), 400
        
    crypto = CryptoCurrency(name=data['name'], price=data['price'])
    db.session.add(crypto)
    db.session.commit()
    return jsonify(crypto.serialize()), 201

@api.route('/cryptocurrency/<int:crypto_id>', methods=['DELETE'])
def delete_crypto(crypto_id):
    crypto = CryptoCurrency.query.get(crypto_id)
    if not crypto:
        return jsonify({"error": "Crypto not found"}), 404
    db.session.delete(crypto)
    db.session.commit()
    return jsonify({"message": "Crypto deleted"}), 200



# ACCIONES 


@api.route('/stock', methods=['GET'])
def get_stocks():
    stocks = Stock.query.all()
    return jsonify([s.serialize() for s in stocks]), 200

@api.route('/stock/<int:stock_id>', methods=['GET'])
def get_stock(stock_id):
    stock = Stock.query.get(stock_id)
    if not stock:
        return jsonify({"error": "Stock not found"}), 404
    return jsonify(stock.serialize()), 200

@api.route('/stock', methods=['POST'])
def create_stock():
    data = request.get_json()
    if not data or 'name' not in data or 'price' not in data:
        return jsonify({"error": "Missing name or price"}), 400
        
    stock = Stock(name=data['name'], price=data['price'])
    db.session.add(stock)
    db.session.commit()
    return jsonify(stock.serialize()), 201

@api.route('/stock/<int:stock_id>', methods=['DELETE'])
def delete_stock(stock_id):
    stock = Stock.query.get(stock_id)
    if not stock:
        return jsonify({"error": "Stock not found"}), 404
    db.session.delete(stock)
    db.session.commit()
    return jsonify({"message": "Stock deleted"}), 200



# FAVORITOS


@api.route('/favorite', methods=['GET'])
@token_required
def get_favorites(current_user):
    favorites = Favorite.query.filter_by(user_id=current_user.id).all()
    serialized_favorites = [fav.serialize() for fav in favorites if fav.serialize() is not None]
    return jsonify(serialized_favorites), 200


@api.route('/favorite', methods=['POST'])
@token_required
def create_favorite(current_user):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    fund_id = data.get('fund_id')
    etf_id = data.get('etf_id')
    crypto_id = data.get('crypto_id')
    stock_id = data.get('stock_id')


    if fund_id and not Fund.query.get(fund_id):
        return jsonify({"error": f"El Fondo con ID {fund_id} no existe en la base de datos."}), 404

    if etf_id and not ETF.query.get(etf_id):
        return jsonify({"error": f"El ETF con ID {etf_id} no existe en la base de datos."}), 404

    if crypto_id and not CryptoCurrency.query.get(crypto_id):
        return jsonify({"error": f"La Criptomoneda con ID {crypto_id} no existe en la base de datos."}), 404

    if stock_id and not Stock.query.get(stock_id):
        return jsonify({"error": f"La Acción con ID {stock_id} no existe en la base de datos."}), 404

    favorite = Favorite(
        user_id=current_user.id,
        fund_id=fund_id,
        etf_id=etf_id,
        crypto_id=crypto_id,
        stock_id=stock_id
    )
    
    try:
        db.session.add(favorite)
        db.session.commit()
        return jsonify({"message": "Favorite created successfully", "favorite": favorite.serialize()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Error interno del servidor al guardar el favorito."}), 500


@api.route('/favorite/<int:favorite_id>', methods=['DELETE'])
@token_required
def delete_favorite(current_user, favorite_id):
    favorite = Favorite.query.filter_by(id=favorite_id, user_id=current_user.id).first()
    if not favorite:
        return jsonify({"error": "Favorite not found or unauthorized"}), 404
        
    db.session.delete(favorite)
    db.session.commit()
    return jsonify({"message": "Favorite deleted"}), 200



# NOTICIAS


def get_external_news_data(endpoint: str, params: dict):
    """Función general para manejar la obtención de noticias desde el API externo."""
    full_url = f"{NEWS_API_BASE_URL}{endpoint}"
    params['api_token'] = NEWS_API_TOKEN
    try:
        response = requests.get(full_url, params=params)
        response.raise_for_status() 
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error al conectar con la API de noticias: {e}")
        raise Exception("No se pudo conectar o validar los datos de las noticias externas.")


@api.route('/news', methods=['GET'])
def get_news():
    """Endpoint para obtener todas las noticias desde la API externa."""
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