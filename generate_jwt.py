import jwt
import json
from datetime import datetime, timedelta

# Token payload
payload = {
    "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
    "iat": int(datetime.utcnow().timestamp()),
    "aud": "https://canton.network.global",
    "sub": "97bb6cef-a7a9-410b-ba8c-ada08451a5c9",
    "admin": True,
    "actAs": ["AcmePayroll::1220d19c5817f45ed90da1c93a7f6d5a20538458aeca7b15dfb9a7d9b30fb435a5b7"],
    "readAs": [],
    "participantId": "",
    "applicationId": "payroll-poc"
}

# Generate token with HMAC-256 and kid header
token = jwt.encode(
    payload, 
    "unsafe", 
    algorithm="HS256",
    headers={"kid": "unsafe"}
)
print(token)
