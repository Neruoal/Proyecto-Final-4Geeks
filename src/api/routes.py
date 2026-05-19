"""
This module takes care of starting the API Server, Loading the DB and Adding the endpoints
"""
from flask import Flask, request, jsonify, url_for, Blueprint
from api.models import db, User, Favorite
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
    favorite = Favorite.query.filter_by(id=favorite_id, user_id=current_user.id).first()
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
        raise Exception("No se pudo conectar o validar los datos de las noticias externas.")


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