import { initializeApp } from "firebase/app";
import { getDatabase, ref } from "firebase/database";

// Firebase Configuration from user database
const firebaseConfig = {
  apiKey: "AIzaSyC9TWZbygXniEE2gE0SU08mFnaeCH2wlz8",
  authDomain: "my-shop-music.firebaseapp.com",
  databaseURL: "https://my-shop-music-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "my-shop-music",
  storageBucket: "my-shop-music.firebasestorage.app",
  messagingSenderId: "113291989652",
  appId: "1:113291989652:web:cc529e1558f661e29f5a81",
  measurementId: "G-SM2FQCB6YS"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const songsRef = ref(db, 'songs');
