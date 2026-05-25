from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta

db = SQLAlchemy()

class MarketCache(db.Model):
    __tablename__ = 'market_cache'
    id = db.Column(db.Integer, primary_key=True)
    ticker = db.Column(db.String(20), nullable=False)
    data_type = db.Column(db.String(20), nullable=False)  # quote, history, recommendation
    response_data = db.Column(db.Text, nullable=False)     # JSON string
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    def is_expired(self):
        return datetime.utcnow() > self.expires_at
    def serialize(self):
        return {
            "ticker": self.ticker,
            "data_type": self.data_type,
            "response_data": self.response_data,
            "expires_at": self.expires_at.isoformat()
        }



# USUARIO


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False) 
    is_active = db.Column(db.Boolean(), default=True)

    wallets = db.relationship("Wallet", back_populates="user", cascade="all, delete-orphan")
    favorites = db.relationship("Favorite", back_populates="user", cascade="all, delete-orphan")

    def serialize(self):
        return {
            "id": self.id,
            "email": self.email,
            "is_active": self.is_active
        }



# WALLET 

class Wallet(db.Model):
    __tablename__ = 'wallets'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    bank_name = db.Column(db.String(80), nullable=False)  
    liquidity = db.Column(db.Float, default=0.0)          
    
    user = db.relationship("User", back_populates="wallets")

    def serialize(self):
        return {
            "id": self.id,
            "bank_name": self.bank_name,
            "liquidity": self.liquidity
        }

# FAVORITOS


class Favorite(db.Model):
    __tablename__ = 'favorites'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    asset_ticker = db.Column(db.String(50), nullable=False) 
    asset_name = db.Column(db.String(120), nullable=False)   
    asset_type = db.Column(db.String(20), nullable=False) 

    user = db.relationship("User", back_populates="favorites")

    def serialize(self):
        return {
            "id": self.id,
            "asset_ticker": self.asset_ticker,
            "asset_name": self.asset_name,
            "asset_type": self.asset_type
        }