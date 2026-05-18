from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

db = SQLAlchemy()


# USUARIO


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False) 
    is_active = db.Column(db.Boolean(), default=True)

    wallet = db.relationship("Wallet", back_populates="user", uselist=False)
    favorites = db.relationship("Favorite", back_populates="user")

    def serialize(self):
        return {
            "id": self.id,
            "email": self.email,
            "wallet": self.wallet.serialize() if self.wallet else None,
            "favorites": [fav.serialize() for fav in self.favorites if fav.serialize() is not None]
        }

class Wallet(db.Model):
    __tablename__ = 'wallets'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    liquidity = db.Column(db.Float, default=0.0) 
    
    user = db.relationship("User", back_populates="wallet")

    def serialize(self):
        return {
            "id": self.id,
            "liquidity": self.liquidity,
            "user_id": self.user_id
        }


# ACTIVOS


class Fund(db.Model):
    __tablename__ = 'funds'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    price = db.Column(db.Float, nullable=False)
    
    favorites = db.relationship("Favorite", back_populates="fund")

    def serialize(self):
        return {"id": self.id, "name": self.name, "price": self.price, "category": "fund"}

class ETF(db.Model):
    __tablename__ = 'etfs'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    price = db.Column(db.Float, nullable=False)

    favorites = db.relationship("Favorite", back_populates="etf")

    def serialize(self):
        return {"id": self.id, "name": self.name, "price": self.price, "category": "etf"}

class CryptoCurrency(db.Model):
    __tablename__ = 'cryptos'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    price = db.Column(db.Float, nullable=False)

    favorites = db.relationship("Favorite", back_populates="crypto")

    def serialize(self):
        return {"id": self.id, "name": self.name, "price": self.price, "category": "crypto"}

class Stock(db.Model):
    __tablename__ = 'stocks'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    price = db.Column(db.Float, nullable=False)

    favorites = db.relationship("Favorite", back_populates="stock")

    def serialize(self):

        return {"id": self.id, "name": self.name, "price": self.price, "category": "stock"}

# FAVORITOS


class Favorite(db.Model):
    __tablename__ = 'favorites'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    fund_id = db.Column(db.Integer, db.ForeignKey('funds.id', ondelete="CASCADE"), nullable=True)
    etf_id = db.Column(db.Integer, db.ForeignKey('etfs.id', ondelete="CASCADE"), nullable=True)
    crypto_id = db.Column(db.Integer, db.ForeignKey('cryptos.id', ondelete="CASCADE"), nullable=True)
    stock_id = db.Column(db.Integer, db.ForeignKey('stocks.id', ondelete="CASCADE"), nullable=True)

    user = db.relationship("User", back_populates="favorites")
    fund = db.relationship("Fund", back_populates="favorites")
    etf = db.relationship("ETF", back_populates="favorites")
    crypto = db.relationship("CryptoCurrency", back_populates="favorites")
    stock = db.relationship("Stock", back_populates="favorites")

    def serialize(self):
        
        relationships = [
            (self.fund, "fund"),
            (self.etf, "etf"),
            (self.crypto, "crypto"),
            (self.stock, "stock")
        ]

        active_item = None
        for obj, label in relationships:
            if obj is not None:
                active_item = obj.serialize()
                break

        
        if active_item is None:
            return None 

        return {
            "id": self.id,
            "user_id": self.user_id,
            "item": active_item
        }

class News(db.Model):
    __tablename__ = 'news'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    source = db.Column(db.String(255))
    url = db.Column(db.String(500)) 

    def serialize(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "source": self.source,
            "url": self.url
        }