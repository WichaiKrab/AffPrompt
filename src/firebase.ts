import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// ดึงค่าจาก Environment Variables ของ Vite (ต้องนำหน้าด้วย VITE_)
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

// ตรวจสอบว่ามีการตั้งค่า Env ครบหรือไม่ (ป้องกันแอปพังตอนลืมใส่ค่า)
if (!firebaseConfig.apiKey) {
  console.warn("Firebase config is missing. Please check your Environment Variables.");
}

const app = initializeApp(firebaseConfig);

// ดึงค่า Database ID แยกออกมา
const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)';

export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);