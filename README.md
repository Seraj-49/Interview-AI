# Interview-AI 🚀

### Your Personal AI-Powered Interview Preparation Platform

Interview-AI is a full-stack web application designed to help candidates prepare for technical and professional interviews through AI-powered mock interviews, resume analysis, voice-based interaction, and performance evaluation.

The platform generates personalized interview questions based on a candidate's role, experience, skills, projects, and resume.

**🌐 Live Demo:** https://interview-ai-client-c0kq.onrender.com

**💻 Repository:** https://github.com/Seraj-49/Interview-AI

---

## ✨ Features

- **AI-Powered Mock Interviews** – Generate personalized interview questions based on your selected role, experience, and interview mode.
- **Resume Analysis** – Upload a PDF resume and extract relevant information, including skills, projects, experience, and professional role.
- **Voice-Based Interviews** – Interact with AI-generated interview questions using speech recognition and text-to-speech.
- **Adaptive Follow-Up Questions** – Receive relevant follow-up questions based on your previous answers.
- **AI Performance Evaluation** – Evaluate answers based on confidence, communication, correctness, relevance, structure, and problem-solving.
- **Interview Reports** – Review scores, feedback, and interview history to identify areas for improvement.
- **User Authentication** – Google authentication using Firebase.
- **Credit Management** – Manage interview credits and view transaction history.
- **Payment Integration** – Razorpay integration with test-mode checkout and payment verification.

## 🛠️ Tech Stack

### Frontend
- React 19
- Vite
- JavaScript
- Tailwind CSS
- Redux Toolkit
- React Router
- Axios
- Firebase Authentication

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- Multer
- PDF.js

### AI & External Services
- OpenRouter – AI-powered interview question generation, answer evaluation, and resume analysis
- ElevenLabs – AI text-to-speech
- Razorpay – Payment gateway integration
- Firebase – Google authentication

### Deployment
- Render – Frontend and backend hosting
- MongoDB Atlas – Database hosting

## 🏗️ Project Structure

```text
Interview-AI/
│
├── Client/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── config/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── redux/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.js
│
├── Server/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── .env.example
│   ├── index.js
│   └── package.json
│
└── README.md
```

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Seraj-49/Interview-AI.git
cd Interview-AI
```

### 2. Install frontend dependencies

```bash
cd Client
npm install
```

Create a `.env` file inside the `Client` folder:

```env
VITE_SERVER_URL=http://localhost:8000
VITE_FIREBASE_APIKEY=your_firebase_web_api_key
```

### 3. Install backend dependencies

Open another terminal:

```bash
cd Server
npm install
```

Create a `.env` file inside the `Server` folder using `.env.example` as a reference.

Configure the following environment variables:

```env
PORT=8000
CLIENT_URL=http://localhost:5173

MONGODB_URL=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

OPENROUTER_API_KEY=your_openrouter_api_key
INITIAL_FREE_CREDITS=100

DEMO_PAYMENT_ENABLED=true
DEMO_PAYMENT_RESULT=success

RAZORPAY_KEY_ID=your_razorpay_test_key_id
RAZORPAY_KEY_SECRET=your_razorpay_test_key_secret
RAZORPAY_MODE=test

ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

Use your own credentials. Never commit `.env` files or expose API secrets in the frontend.

### 4. Start the backend

```bash
cd Server
npm run dev
```

### 5. Start the frontend

```bash
cd Client
npm run dev
```

Open the local URL provided by Vite, usually:

```text
http://localhost:5173
```

## 🔐 Security Notes

- Keep API keys and database credentials in environment variables.
- Never expose Razorpay secret keys or JWT secrets in frontend code.
- Configure Firebase authorized domains for your deployment.
- Use HTTPS and secure cookies in production.
- Use Razorpay Test Mode for testing payments.

## 🚀 Future Improvements

- More interview modes and specialized question sets.
- Improved speech recognition and real-time voice interaction.
- Advanced interview analytics and progress tracking.
- More detailed resume feedback and recommendations.
- Additional authentication and payment options.

## 👨‍💻 Author

**Seraj Ahmad**

B.Tech – Information Technology | 2028

- GitHub: https://github.com/Seraj-49
- LinkedIn: https://www.linkedin.com/in/seraj-ahmad-441505325

---

If you find this project interesting, consider giving the repository a ⭐.

**Built with curiosity, persistence, and a passion for software development.**
