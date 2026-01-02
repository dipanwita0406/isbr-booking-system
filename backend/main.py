from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional
import random
import string
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="ISBR Facility Booking API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Update with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firebase Admin SDK
# Make sure to download your Firebase service account key and update the path
try:
    cred = credentials.Certificate("firebase-service-account.json")
    firebase_admin.initialize_app(cred)
except Exception as e:
    print(f"Warning: Firebase Admin SDK initialization failed: {e}")
    print("Make sure to add your firebase-service-account.json file")

# Admin email list - read from environment variable
ADMIN_EMAILS_STR = os.getenv("ADMIN_EMAILS", "dipanwita957@gmail.com")
ADMIN_EMAILS = [email.strip().lower() for email in ADMIN_EMAILS_STR.split(",") if email.strip()]

print(f"✅ Loaded {len(ADMIN_EMAILS)} admin email(s): {', '.join(ADMIN_EMAILS)}")


class CheckAdminRequest(BaseModel):
    email: EmailStr


class SignupRequest(BaseModel):
    email: EmailStr
    fullName: str
    userType: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


def generate_temporary_password(length: int = 12) -> str:
    """Generate a secure temporary password"""
    characters = string.ascii_letters + string.digits + string.punctuation
    password = ''.join(random.choice(characters) for _ in range(length))
    return password


@app.get("/")
def read_root():
    return {"message": "ISBR Facility Booking API"}


@app.post("/api/check-admin")
async def check_admin(request: CheckAdminRequest):
    """Check if an email is in the admin list"""
    is_admin = request.email.lower() in [email.lower() for email in ADMIN_EMAILS]
    return {"isAdmin": is_admin}


@app.post("/api/signup")
async def signup(request: SignupRequest):
    """Handle student/staff signup - create Firebase account and return credentials for frontend to email"""
    try:
        # Check if trying to sign up as admin
        if request.userType == "admin":
            raise HTTPException(
                status_code=403, 
                detail="Admins cannot sign up through this form. Please contact IT support."
            )
        
        # Check if email is an admin email
        is_admin = request.email.lower() in [email.lower() for email in ADMIN_EMAILS]
        if is_admin:
            raise HTTPException(
                status_code=403,
                detail="This is an authorized admin email. Admins cannot sign up through this form."
            )
        
        # Generate temporary password
        temp_password = generate_temporary_password()
        
        # Create user in Firebase
        try:
            user = firebase_auth.create_user(
                email=request.email,
                password=temp_password,
                display_name=request.fullName,
                email_verified=False
            )
            
            # Return credentials to frontend for email sending
            return {
                "success": True,
                "message": "Account created successfully",
                "userId": user.uid,
                "emailData": {
                    "to_name": request.fullName,
                    "to_email": request.email,
                    "user_name": request.fullName,
                    "temporary_password": temp_password,
                    "login_url": "http://localhost:3000/login",
                    "app_name": "ISBR Facility Booking System",
                    "reply_to": request.email
                }
            }
            
        except firebase_auth.EmailAlreadyExistsError:
            raise HTTPException(
                status_code=400,
                detail="An account with this email already exists. Please try signing in or use forgot password."
            )
        except Exception as e:
            print(f"Firebase user creation error: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create account: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Signup error: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred during signup")


@app.post("/api/reset-password-request")
async def reset_password_request(request: PasswordResetRequest):
    """Generate password reset link for frontend to email"""
    try:
        # Generate password reset link using Firebase Admin
        link = firebase_auth.generate_password_reset_link(request.email)
        
        # Return data to frontend for email sending
        return {
            "success": True,
            "message": "Password reset link generated",
            "emailData": {
                "to_email": request.email,
                "reset_link": link,
                "app_name": "ISBR Facility Booking System"
            }
        }
        
    except firebase_auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="No account found with this email address")
    except Exception as e:
        print(f"Password reset error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate password reset link")


@app.get("/api/admin-emails")
async def get_admin_emails():
    """Get list of admin emails (protected endpoint - add authentication in production)"""
    return {"adminEmails": ADMIN_EMAILS}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)