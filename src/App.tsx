/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  ref, 
  push, 
  onValue, 
  update, 
  remove, 
  set 
} from "firebase/database";
import { 
  Music, 
  UserRound, 
  UserCog, 
  Search, 
  Trash2, 
  Play, 
  Check, 
  Copy, 
  ExternalLink, 
  Lock, 
  RotateCcw, 
  Volume2, 
  VolumeX,
  Pause,
  SkipForward,
  SkipBack,
  Tv, 
  X, 
  Layers, 
  CheckCircle, 
  Info, 
  ChevronUp, 
  ChevronDown, 
  Armchair, 
  Clock, 
  AlertTriangle,
  ChevronLeft
} from "lucide-react";
import { db, songsRef } from "./lib/firebase";
import { SongRequest, YouTubeSearchResult } from "./types";

const YT_API_KEY = 'AIzaSyComYbMyJPLjnQEErW_V7q4xpYZcNkIfdk';
const DJ_PASSWORD = '1';

// Format YouTube ISO 8601 duration to human readable (e.g. PT3M45S -> 3:45)
function formatISO8601Duration(isoDuration: string): string {
  if (!isoDuration) return "00:00";
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "00:00";
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  
  let result = "";
  if (hours > 0) {
    result += hours + ":" + (minutes < 10 ? "0" : "");
  }
  result += minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  return result;
}

// Extract Video ID from various YouTube URL formats
function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

interface FallbackSong {
  id: string;
  song: string;
  url: string;
  category: 'acoustic' | 'pop' | 'rock' | 'lukthung' | 'party' | 'general';
}

const FALLBACK_PLAYLISTS: FallbackSong[] = [
  // Acoustic / Cafe Chill
  { id: 'Z-M6S4S9-m4', song: 'โต๊ะริม (Melt) - NONT TANONT', url: 'https://www.youtube.com/watch?v=Z-M6S4S9-m4', category: 'acoustic' },
  { id: 'O81S_Xp-j_Y', song: 'พิง (ประกอบละครกระเช้าสีดา) - NONT TANONT', url: 'https://www.youtube.com/watch?v=O81S_Xp-j_Y', category: 'acoustic' },
  { id: '_7zS9_Y-g6Y', song: 'วาฬเกยตื้น - GUNGUN', url: 'https://www.youtube.com/watch?v=_7zS9_Y-g6Y', category: 'acoustic' },
  { id: 'S7l_gB_gAkw', song: 'ซูลูปาก้า ตาปาเฮ้ - THE TOYS', url: 'https://www.youtube.com/watch?v=S7l_gB_gAkw', category: 'acoustic' },
  { id: '37N1L4-g_oA', song: 'ฝนตกไหม - Three Man Down', url: 'https://www.youtube.com/watch?v=37N1L4-g_oA', category: 'acoustic' },
  { id: 'O5E_XWzWJGo', song: 'คิดแต่ไม่ถึง (Mean It) - Tilly Birds', url: 'https://www.youtube.com/watch?v=O5E_XWzWJGo', category: 'acoustic' },

  // Thai Pop / String Hits
  { id: 'a_O868_Y-l0', song: 'รักแรก (First Love) - NONT TANONT', url: 'https://www.youtube.com/watch?v=a_O868_Y-l0', category: 'pop' },
  { id: 'qg64fN-A-Kk', song: 'เพื่อนเล่น ไม่เล่นเพื่อน (Just Being Friendly) - Tilly Birds', url: 'https://www.youtube.com/watch?v=qg64fN-A-Kk', category: 'pop' },
  { id: 'Hw-G7L7m_50', song: 'เลือดกรุ๊ปบี (B Blood) - Chrrissa Chコツ', url: 'https://www.youtube.com/watch?v=Hw-G7L7m_50', category: 'pop' },
  { id: 'sU-g_B-X-Yw', song: 'วัดปะหล่ะ? (TEST ME) - 4EVE', url: 'https://www.youtube.com/watch?v=sU-g_B-X-Yw', category: 'pop' },
  { id: 'oWJ6S7S-Z3w', song: 'นะหน้าทอง - โจอี้ ภูวศิษฐ์', url: 'https://www.youtube.com/watch?v=oWJ6S7S-Z3w', category: 'pop' },
  { id: 'X9L_gSgM-N0', song: 'ดวงเดือน - โจอี้ ภูวศิษฐ์', url: 'https://www.youtube.com/watch?v=X9L_gSgM-N0', category: 'pop' },

  // Rock / Modern Indy Alternative
  { id: '8_Lg6Gg_9m8', song: 'ทรงอย่างแบด (Bad Boy) - Paper Planes', url: 'https://www.youtube.com/watch?v=8_Lg6Gg_9m8', category: 'rock' },
  { id: 'qS-Sg9S9-M4', song: 'แดงกับเขียว - TaitosmitH', url: 'https://www.youtube.com/watch?v=qS-Sg9S9-M4', category: 'rock' },
  { id: 'o98S_Wg_G-0', song: 'Hello Mama - TaitosmitH', url: 'https://www.youtube.com/watch?v=o98S_Wg_G-0', category: 'rock' },
  { id: 'O-8S_Xs-L-M', song: 'ทนได้ทุกที - COCKTAIL', url: 'https://www.youtube.com/watch?v=O-8S_Xs-L-M', category: 'rock' },

  // Lukthung / Country / Isan Hits
  { id: 'O8s_Xw-Z_9Y', song: 'คาถาขุนแผน (หลวงพ่อกวย) - กานต์ ทศน', url: 'https://www.youtube.com/watch?v=O8s_Xw-Z_9Y', category: 'lukthung' },
  { id: 'o_8s-G-Y80A', song: 'คำว่าฮักกัน มันเหี่ยถิ่มไส - มนต์แคน แก่นคูน', url: 'https://www.youtube.com/watch?v=o_8s-G-Y80A', category: 'lukthung' },
  { id: 'Z-9S_Wp-G-0', song: 'วอนวัยรุ่น - มนต์แคน แก่นคูน', url: 'https://www.youtube.com/watch?v=Z-9S_Wp-G-0', category: 'lukthung' },

  // Party / Dance / 3-Cha
  { id: 'o8S_S9-G_Yw', song: 'สิบสอง - จ๊ะ นงผณี', url: 'https://www.youtube.com/watch?v=o8S_S9-G_Yw', category: 'party' },
  { id: '_w9S_S9S-m4', song: 'คอแห้ง - F.HERO x Joey Phuwasit', url: 'https://www.youtube.com/watch?v=_w9S_S9S-m4', category: 'party' },
  { id: 'Z9S8_X9S-Y0', song: 'โดดดิด่ง (Ost. ไทบ้าน x BNK48) - BNK48', url: 'https://www.youtube.com/watch?v=Z9S8_X9S-Y0', category: 'party' },
];

function classifySongCategory(title: string): FallbackSong['category'] {
  const t = title.toLowerCase();
  
  if (
    t.includes('มนต์แคน') || t.includes('แก่นคูน') || t.includes('ลูกทุ่ง') || 
    t.includes('หมอลำ') || t.includes('เพื่อชีวิต') || t.includes('ทศน') || 
    t.includes('จักรพันธ์') || t.includes('อีสาน') || t.includes('กานต์') || t.includes('ไทบ้าน')
  ) {
    return 'lukthung';
  }
  
  if (
    t.includes('paper planes') || t.includes('ทรงอย่างแบด') || t.includes('เสแสร้ง') || 
    t.includes('cocktail') || t.includes('taitosmith') || t.includes('ร็อค') || 
    t.includes('rock') || t.includes('silly fools') || t.includes('โลโซ') || 
    t.includes('loso') || t.includes('bodyslam') || t.includes('บอดี้สแลม')
  ) {
    return 'rock';
  }

  if (
    t.includes('dance') || t.includes('แดนซ์') || t.includes('ปาร์ตี้') || 
    t.includes('party') || t.includes('edm') || t.includes('จ๊ะ') || 
    t.includes('คอแห้ง') || t.includes('ไซเรน') || t.includes('สามช่า')
  ) {
    return 'party';
  }

  if (
    t.includes('acoustic') || t.includes('ชิล') || t.includes('อะคูสติก') || 
    t.includes('คาเฟ่') || t.includes('cafe') || t.includes('nont tanont') || 
    t.includes('นนท์ ธนนท์') || t.includes('โต๊ะริม') || t.includes('พิง') || 
    t.includes('เบา') || t.includes('สบาย') || t.includes('lullaby') || 
    t.includes('วาฬเกยตื้น') || t.includes('the toys') || t.includes('เดอะ ทอย')
  ) {
    return 'acoustic';
  }

  if (
    t.includes('pop') || t.includes('ป็อป') || t.includes('สตริง') || 
    t.includes('4eve') || t.includes('tilly birds') || t.includes('three man down') || 
    t.includes('รักแรก')
  ) {
    return 'pop';
  }

  return 'general';
}

function getNextRecommendedSong(currentTitle: string, currentVideoId: string): FallbackSong {
  const category = classifySongCategory(currentTitle);
  let matchingSongs = FALLBACK_PLAYLISTS.filter(s => s.category === category && s.id !== currentVideoId);
  
  if (matchingSongs.length === 0) {
    matchingSongs = FALLBACK_PLAYLISTS.filter(s => s.id !== currentVideoId);
  }
  
  const randomIndex = Math.floor(Math.random() * matchingSongs.length);
  return matchingSongs[randomIndex] || FALLBACK_PLAYLISTS[0];
}

export default function App() {
  // Page states: 'landing' | 'customer' | 'dj'
  const [currentPage, setCurrentPage] = useState<'landing' | 'customer' | 'dj'>('landing');
  const [currentTab, setCurrentTab] = useState<'pending' | 'playing' | 'completed'>('pending');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // DB Sync Queue
  const [songQueue, setSongQueue] = useState<SongRequest[]>([]);
  
  // Filtering & Input States
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVideoUrl, setSelectedVideoUrl] = useState("");
  const [youtubeSearchResults, setYoutubeSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Custom Alerts / Feedback
  const [statusAlert, setStatusAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters for displaying queues
  const [customerTableFilter, setCustomerTableFilter] = useState<string>("none");
  const [adminTableFilter, setAdminTableFilter] = useState<string>("all");

  // YouTube Player States
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [playingSongTitle, setPlayingSongTitle] = useState<string>("ยังไม่ได้เลือกเพลง");
  const [playingQueueId, setPlayingQueueId] = useState<string | null>(null);
  const [hasPlayerError, setHasPlayerError] = useState(false);
  
  const playerRef = useRef<any>(null);

  // DJ Modern Management States
  const [djSearchQuery, setDjSearchQuery] = useState("");
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(true);
  const [isTableFairSort, setIsTableFairSort] = useState(false);

  // DJ Recommended Playlists & AutoPlay States
  const [recommendedCategories, setRecommendedCategories] = useState<Record<string, any>>({});
  const [activeCategoryId, setActiveCategoryId] = useState<string>("category-acoustic");
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] = useState<string>("category-acoustic");
  const [newCategoryName, setNewCategoryName] = useState<string>("");
  const [newSongTitle, setNewSongTitle] = useState<string>("");
  const [newSongUrl, setNewSongUrl] = useState<string>("");

  // YouTube Player Playback states
  const [isYtPlaying, setIsYtPlaying] = useState(false);
  const [isYtMuted, setIsYtMuted] = useState(false);
  const [ytVolume, setYtVolume] = useState(100);
  const [ytCurrentTime, setYtCurrentTime] = useState(0);
  const [ytDuration, setYtDuration] = useState(0);

  const playingQueueIdRef = useRef<string | null>(null);

  // 1. Initial URL Params Check & Deep-Linking Router Setup
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tableParam = urlParams.get('table');
    const modeParam = urlParams.get('mode'); // 'customer' or 'dj'
    
    if (tableParam) {
      setSelectedTable(tableParam);
      setCustomerTableFilter(tableParam);
    }
    
    if (modeParam === 'dj') {
      setCurrentPage('dj');
    } else if (modeParam === 'customer' || tableParam) {
      setCurrentPage('customer');
    } else {
      setCurrentPage('landing');
    }
  }, []);

  // 2. Listen to Real-time Changes in Firebase
  useEffect(() => {
    const unsubscribe = onValue(songsRef, (snapshot) => {
      const data = snapshot.val();
      const loadedSongs: SongRequest[] = [];
      
      if (data) {
        Object.keys(data).forEach((key) => {
          loadedSongs.push({ id: key, ...data[key] });
        });
        // Sort by order ASC
        loadedSongs.sort((a, b) => (a.order || 0) - (b.order || 0));
      }
      
      setSongQueue(loadedSongs);
    }, (error) => {
      console.error("Firebase Database read error:", error);
    });

    return () => unsubscribe();
  }, []);

  // Listen to Recommended Categories in Firebase & Seed Defaults if empty
  useEffect(() => {
    const categoriesRef = ref(db, 'recommended_categories');
    const unsubscribe = onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        // Seeding default categories
        const defaults: Record<string, any> = {
          'category-acoustic': {
            id: 'category-acoustic',
            name: 'เพลงอะคูสติกฟังสบายสไตล์คาเฟ่ (Acoustic Cafe)',
            songs: {
              'song-1': { id: 'song-1', song: 'โต๊ะริม (Melt) - NONT TANONT', url: 'https://www.youtube.com/watch?v=Z-M6S4S9-m4', videoId: 'Z-M6S4S9-m4' },
              'song-2': { id: 'song-2', song: 'พิง (ประกอบละครกระเช้าสีดา) - NONT TANONT', url: 'https://www.youtube.com/watch?v=O81S_Xp-j_Y', videoId: 'O81S_Xp-j_Y' },
              'song-3': { id: 'song-3', song: 'วาฬเกยตื้น - GUNGUN', url: 'https://www.youtube.com/watch?v=_7zS9_Y-g6Y', videoId: '_7zS9_Y-g6Y' },
              'song-4': { id: 'song-4', song: 'ซูลูปาก้า ตาปาเฮ้ - THE TOYS', url: 'https://www.youtube.com/watch?v=S7l_gB_gAkw', videoId: 'S7l_gB_gAkw' },
              'song-5': { id: 'song-5', song: 'ฝนตกไหม - Three Man Down', url: 'https://www.youtube.com/watch?v=37N1L4-g_oA', videoId: '37N1L4-g_oA' },
              'song-6': { id: 'song-6', song: 'คิดแต่ไม่ถึง (Mean It) - Tilly Birds', url: 'https://www.youtube.com/watch?v=O5E_XWzWJGo', videoId: 'O5E_XWzWJGo' }
            }
          },
          'category-pop': {
            id: 'category-pop',
            name: 'เพลงป็อปฮิตติดเทรนด์ (Thai Pop)',
            songs: {
              'song-1': { id: 'song-1', song: 'รักแรก (First Love) - NONT TANONT', url: 'https://www.youtube.com/watch?v=a_O868_Y-l0', videoId: 'a_O868_Y-l0' },
              'song-2': { id: 'song-2', song: 'เพื่อนเล่น ไม่เล่นเพื่อน (Just Being Friendly) - Tilly Birds', url: 'https://www.youtube.com/watch?v=qg64fN-A-Kk', videoId: 'qg64fN-A-Kk' },
              'song-3': { id: 'song-3', song: 'เลือดกรุ๊ปบี (B Blood) - Chrrissa Ch', url: 'https://www.youtube.com/watch?v=Hw-G7L7m_50', videoId: 'Hw-G7L7m_50' },
              'song-4': { id: 'song-4', song: 'วัดปะหล่ะ? (TEST ME) - 4EVE', url: 'https://www.youtube.com/watch?v=sU-g_B-X-Yw', videoId: 'sU-g_B-X-Yw' },
              'song-5': { id: 'song-5', song: 'นะหน้าทอง - โจอี้ ภูวศิษฐ์', url: 'https://www.youtube.com/watch?v=oWJ6S7S-Z3w', videoId: 'oWJ6S7S-Z3w' },
              'song-6': { id: 'song-6', song: 'ดวงเดือน - โจอี้ ภูวศิษฐ์', url: 'https://www.youtube.com/watch?v=X9L_gSgM-N0', videoId: 'X9L_gSgM-N0' }
            }
          },
          'category-rock': {
            id: 'category-rock',
            name: 'เพลงร็อคมันส์กระแทกใจ (Rock Cafe)',
            songs: {
              'song-1': { id: 'song-1', song: 'ทรงอย่างแบด (Bad Boy) - Paper Planes', url: 'https://www.youtube.com/watch?v=8_Lg6Gg_9m8', videoId: '8_Lg6Gg_9m8' },
              'song-2': { id: 'song-2', song: 'แดงกับเขียว - TaitosmitH', url: 'https://www.youtube.com/watch?v=qS-Sg9S9-M4', videoId: 'qS-Sg9S9-M4' },
              'song-3': { id: 'song-3', song: 'Hello Mama - TaitosmitH', url: 'https://www.youtube.com/watch?v=o98S_Wg_G-0', videoId: 'o98S_Wg_G-0' },
              'song-4': { id: 'song-4', song: 'ทนได้ทุกที - COCKTAIL', url: 'https://www.youtube.com/watch?v=O-8S_Xs-L-M', videoId: 'O-8S_Xs-L-M' }
            }
          },
          'category-lukthung': {
            id: 'category-lukthung',
            name: 'เพลงสามช่าลูกทุ่งและปาร์ตี้ (Lukthung Party)',
            songs: {
              'song-1': { id: 'song-1', song: 'คาถาขุนแผน (หลวงพ่อกวย) - กานต์ ทศน', url: 'https://www.youtube.com/watch?v=O8s_Xw-Z_9Y', videoId: 'O8s_Xw-Z_9Y' },
              'song-2': { id: 'song-2', song: 'คำว่าฮักกัน มันเหี่ยถิ่มไส - มนต์แคน แก่นคูน', url: 'https://www.youtube.com/watch?v=o_8s-G-Y80A', videoId: 'o_8s-G-Y80A' },
              'song-3': { id: 'song-3', song: 'วอนวัยรุ่น - มนต์แคน แก่นคูน', url: 'https://www.youtube.com/watch?v=Z-9S_Wp-G-0', videoId: 'Z-9S_Wp-G-0' },
              'song-4': { id: 'song-4', song: 'สิบสอง - จ๊ะ นงผณี', url: 'https://www.youtube.com/watch?v=o8S_S9-G_Yw', videoId: 'o8S_S9-G_Yw' },
              'song-5': { id: 'song-5', song: 'คอแห้ง - F.HERO x Joey Phuwasit', url: 'https://www.youtube.com/watch?v=_w9S_S9S-m4', videoId: '_w9S_S9S-m4' },
              'song-6': { id: 'song-6', song: 'โดดดิด่ง (Ost. ไทบ้าน x BNK48) - BNK48', url: 'https://www.youtube.com/watch?v=Z9S8_X9S-Y0', videoId: 'Z9S8_X9S-Y0' }
            }
          }
        };
        set(categoriesRef, defaults);
        setRecommendedCategories(defaults);
        if (!selectedCategoryForEdit) {
          setSelectedCategoryForEdit('category-acoustic');
        }
      } else {
        setRecommendedCategories(data);
        const keys = Object.keys(data);
        if (keys.length > 0 && !selectedCategoryForEdit) {
          setSelectedCategoryForEdit(keys[0]);
        }
      }
    }, (error) => {
      console.error("Firebase categories read error:", error);
    });

    return () => unsubscribe();
  }, [selectedCategoryForEdit]);

  // Listen to Active Recommended Category ID
  useEffect(() => {
    const activeRef = ref(db, 'settings/active_recommended_category_id');
    const unsubscribe = onValue(activeRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        set(activeRef, 'category-acoustic');
        setActiveCategoryId('category-acoustic');
      } else {
        setActiveCategoryId(data);
      }
    }, (error) => {
      console.error("Firebase active category read error:", error);
    });

    return () => unsubscribe();
  }, []);

  // Table-Fair queue sorting helper (Round-Robin distribution across tables)
  const getTableFairSortedSongs = (pendingSongs: SongRequest[]) => {
    const groups: Record<string | number, SongRequest[]> = {};
    pendingSongs.forEach(song => {
      const tbl = song.table;
      if (!groups[tbl]) {
        groups[tbl] = [];
      }
      groups[tbl].push(song);
    });

    Object.keys(groups).forEach(tbl => {
      groups[tbl].sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    const tableKeys = Object.keys(groups).sort((a, b) => {
      const firstA = groups[a][0]?.order || 0;
      const firstB = groups[b][0]?.order || 0;
      return firstA - firstB;
    });

    const sorted: SongRequest[] = [];
    const maxGroupLength = Math.max(...Object.values(groups).map(g => g.length), 0);

    for (let round = 0; round < maxGroupLength; round++) {
      tableKeys.forEach(tbl => {
        if (groups[tbl][round]) {
          sorted.push(groups[tbl][round]);
        }
      });
    }
    return sorted;
  };

  // 3. Handle Auto-Playing transition of songs when nothing is playing (Only for active DJ screen)
  useEffect(() => {
    if (currentPage === 'dj' && isAutoPlayEnabled && songQueue.length > 0) {
      const hasPlayingSong = songQueue.some(item => item.status === 'playing');
      const pendingSongs = songQueue.filter(item => item.status === 'pending');
      
      const firstPendingSong = isTableFairSort 
        ? getTableFairSortedSongs(pendingSongs)[0]
        : pendingSongs[0];
      
      // If there is no playing song and there is a pending song in the queue
      if (!hasPlayingSong && firstPendingSong) {
        const ytId = extractYouTubeId(firstPendingSong.url);
        if (ytId) {
          // Play automatically for the DJ
          initAndPlayPlayer(ytId, firstPendingSong.song, firstPendingSong.id);
        }
      }
    }
  }, [songQueue, currentPage, isAutoPlayEnabled, isTableFairSort]);

  // 4. Load YouTube Iframe API
  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // Handle global ready callback
    (window as any).onYouTubeIframeAPIReady = () => {
      console.log("YouTube Player API is fully ready");
    };
  }, []);

  // Periodically query player for current time & duration
  useEffect(() => {
    let interval: any;
    if (playingVideoId && playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      interval = setInterval(() => {
        try {
          const currentTime = playerRef.current.getCurrentTime();
          const duration = playerRef.current.getDuration();
          if (typeof currentTime === 'number') {
            setYtCurrentTime(currentTime);
          }
          if (typeof duration === 'number' && duration > 0) {
            setYtDuration(duration);
          }
        } catch (e) {
          // ignore
        }
      }, 500);
    } else {
      setYtCurrentTime(0);
      setYtDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [playingVideoId, isYtPlaying]);

  // Fetch next recommended song from the selected database active category
  const getNextDbRecommendedSong = (currentVideoId: string) => {
    const activeCat = recommendedCategories[activeCategoryId];
    if (activeCat && activeCat.songs) {
      const songsList = Object.values(activeCat.songs) as any[];
      if (songsList.length > 0) {
        // Filter out current video if possible to avoid playing same song twice in a row
        let candidates = songsList.filter((s: any) => s.videoId !== currentVideoId);
        if (candidates.length === 0) {
          candidates = songsList;
        }
        const randomIndex = Math.floor(Math.random() * candidates.length);
        const selected = candidates[randomIndex];
        return {
          id: selected.videoId,
          song: selected.song,
          url: selected.url
        };
      }
    }

    // Graceful fallback to the hardcoded list if empty
    const nextRec = getNextRecommendedSong(playingSongTitle, currentVideoId);
    return {
      id: nextRec.id,
      song: nextRec.song,
      url: nextRec.url
    };
  };

  // Triggered when a song ends naturally
  const handleSongEnded = (queueId: string) => {
    if (queueId !== 'autoplay-recommendation') {
      moveToStatus(queueId, 'completed');
    } else {
      const updates: Record<string, any> = {};
      updates['/songs/autoplay-recommendation'] = null;
      update(ref(db), updates);
    }

    // Check if there are pending songs in the queue
    const pendingSongs = songQueue.filter(item => item.status === 'pending');
    
    if (pendingSongs.length > 0) {
      // Real customer requested song exists - the standard useEffect will auto-start it when database updates
    } else {
      // No requested songs left! Generate a smart matching song from recommendations
      if (isAutoPlayEnabled) {
        const nextRec = getNextDbRecommendedSong(playingVideoId || '');
        const activeCatName = recommendedCategories[activeCategoryId]?.name || 'หมวดหมู่แนะนำประจำร้าน';
        showStatus('success', `🔀 ดึงเพลง "${nextRec.song}" จากเพลย์ลิสต์ "${activeCatName}" มาสลับเล่นต่ออัตโนมัติ`);
        
        setTimeout(() => {
          initAndPlayPlayer(nextRec.id, nextRec.song, 'autoplay-recommendation');
        }, 1500);
      }
    }
  };

  // Main playback launcher (sets firebase states & starts Iframe SDK instance)
  const initAndPlayPlayer = (videoId: string, songTitle: string, queueId: string) => {
    setHasPlayerError(false);
    setPlayingVideoId(videoId);
    setPlayingSongTitle(songTitle);
    setPlayingQueueId(queueId);
    playingQueueIdRef.current = queueId;
    setIsYtPlaying(true);

    const updates: Record<string, any> = {};
    if (queueId === 'autoplay-recommendation') {
      updates['/songs/autoplay-recommendation'] = {
        id: 'autoplay-recommendation',
        song: songTitle,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        table: 'แนะนำ (AutoPlay)',
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        status: 'playing',
        order: -9999
      };
    } else {
      updates[`/songs/${queueId}/status`] = 'playing';
    }
    
    songQueue.forEach(item => {
      if (item.status === 'playing' && item.id !== queueId) {
        if (item.id === 'autoplay-recommendation') {
          updates['/songs/autoplay-recommendation'] = null;
        } else {
          updates[`/songs/${item.id}/status`] = 'completed';
        }
      }
    });
    update(ref(db), updates);

    // Initialize or load the YouTube Video
    setTimeout(() => {
      try {
        if ((window as any).YT && (window as any).YT.Player) {
          // If player already exists, load video
          if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
            playerRef.current.loadVideoById(videoId);
          } else {
            // Clean container first to avoid duplicate players
            const container = document.getElementById('youtube-player-element');
            if (container) {
              container.innerHTML = '';
              const iframePlaceholder = document.createElement('div');
              iframePlaceholder.id = 'yt-actual-iframe';
              container.appendChild(iframePlaceholder);
              
              playerRef.current = new (window as any).YT.Player('yt-actual-iframe', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: { 
                  autoplay: 1, 
                  playsinline: 1,
                  rel: 0
                },
                events: {
                  onError: () => {
                    setHasPlayerError(true);
                  },
                  onStateChange: (event: any) => {
                    // 0 = YT.PlayerState.ENDED, 1 = PLAYING, 2 = PAUSED
                    if (event.data === 1) {
                      setIsYtPlaying(true);
                      if (playerRef.current) {
                        try {
                          setYtVolume(playerRef.current.getVolume() || 100);
                          setIsYtMuted(playerRef.current.isMuted() || false);
                        } catch (err) {}
                      }
                    } else if (event.data === 2) {
                      setIsYtPlaying(false);
                    }
                    if (event.data === 0) {
                      if (playingQueueIdRef.current) {
                        handleSongEnded(playingQueueIdRef.current);
                      }
                    }
                  }
                }
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed to initialize YT Player: ", err);
      }
    }, 300);
  };

  // YouTube player control helper methods
  const togglePlayPause = () => {
    if (!playerRef.current) return;
    try {
      const state = playerRef.current.getPlayerState();
      if (state === 1) { // playing
        playerRef.current.pauseVideo();
        setIsYtPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsYtPlaying(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const seekForward = () => {
    if (!playerRef.current) return;
    try {
      const cur = playerRef.current.getCurrentTime() || 0;
      playerRef.current.seekTo(cur + 10, true);
    } catch (e) {
      console.error(e);
    }
  };

  const seekBackward = () => {
    if (!playerRef.current) return;
    try {
      const cur = playerRef.current.getCurrentTime() || 0;
      playerRef.current.seekTo(Math.max(0, cur - 10), true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleVolumeChange = (volume: number) => {
    if (!playerRef.current) return;
    try {
      playerRef.current.setVolume(volume);
      setYtVolume(volume);
      if (volume > 0 && isYtMuted) {
        playerRef.current.unMute();
        setIsYtMuted(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    try {
      if (playerRef.current.isMuted()) {
        playerRef.current.unMute();
        setIsYtMuted(false);
      } else {
        playerRef.current.mute();
        setIsYtMuted(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const restartCurrentSong = () => {
    if (!playerRef.current) return;
    try {
      playerRef.current.seekTo(0, true);
      playerRef.current.playVideo();
      setIsYtPlaying(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current || !ytDuration) return;
    try {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const percentage = clickX / width;
      const seekTime = percentage * ytDuration;
      playerRef.current.seekTo(seekTime, true);
      setYtCurrentTime(seekTime);
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === undefined) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Close player manually
  const closeVideoPlayer = () => {
    if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
      playerRef.current.stopVideo();
    }
    if (playingQueueId) {
      moveToStatus(playingQueueId, 'completed');
    }
    setPlayingVideoId(null);
    setPlayingSongTitle("ยังไม่ได้เลือกเพลง");
    setPlayingQueueId(null);
    setHasPlayerError(false);
    setIsYtPlaying(false);
    playerRef.current = null;
  };

  // Update Firebase status helper
  const moveToStatus = (id: string, newStatus: 'pending' | 'playing' | 'completed') => {
    const updates: Record<string, any> = {};
    
    if (id === 'autoplay-recommendation') {
      updates['/songs/autoplay-recommendation'] = null;
    } else {
      updates[`/songs/${id}/status`] = newStatus;
    }

    if (newStatus === 'playing') {
      songQueue.forEach(item => {
        if (item.status === 'playing' && item.id !== id) {
          if (item.id === 'autoplay-recommendation') {
            updates['/songs/autoplay-recommendation'] = null;
          } else {
            updates[`/songs/${item.id}/status`] = 'completed';
          }
        }
      });
    }

    update(ref(db), updates);
  };

  // Move Pending Songs Up / Down in Queue
  const moveQueueUp = (index: number) => {
    let prevPendingIndex = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (songQueue[i].status === 'pending') {
        prevPendingIndex = i;
        break;
      }
    }
    
    if (prevPendingIndex !== -1) {
      const currentOrder = songQueue[index].order;
      const prevOrder = songQueue[prevPendingIndex].order;
      
      const updates: Record<string, any> = {};
      updates[`/songs/${songQueue[index].id}/order`] = prevOrder;
      updates[`/songs/${songQueue[prevPendingIndex].id}/order`] = currentOrder;
      update(ref(db), updates);
    }
  };

  const moveQueueDown = (index: number) => {
    let nextPendingIndex = -1;
    for (let i = index + 1; i < songQueue.length; i++) {
      if (songQueue[i].status === 'pending') {
        nextPendingIndex = i;
        break;
      }
    }
    
    if (nextPendingIndex !== -1) {
      const currentOrder = songQueue[index].order;
      const nextOrder = songQueue[nextPendingIndex].order;
      
      const updates: Record<string, any> = {};
      updates[`/songs/${songQueue[index].id}/order`] = nextOrder;
      updates[`/songs/${songQueue[nextPendingIndex].id}/order`] = currentOrder;
      update(ref(db), updates);
    }
  };

  // Move Pending Song to Absolute Top
  const moveQueueToAbsoluteTop = (index: number) => {
    const song = songQueue[index];
    if (!song) return;
    const pendingSongs = songQueue.filter(item => item.status === 'pending');
    const minOrder = pendingSongs.reduce((min, s) => (s.order < min ? s.order : min), Infinity);
    const targetOrder = minOrder === Infinity ? 0 : minOrder - 1;

    const updates: Record<string, any> = {};
    updates[`/songs/${song.id}/order`] = targetOrder;
    update(ref(db), updates).then(() => {
      showStatus('success', `ย้ายเพลง "${song.song.substring(0, 18)}..." ไปบนสุดแล้ว`);
    });
  };

  // Move Pending Song to Absolute Bottom
  const moveQueueToAbsoluteBottom = (index: number) => {
    const song = songQueue[index];
    if (!song) return;
    const pendingSongs = songQueue.filter(item => item.status === 'pending');
    const maxOrder = pendingSongs.reduce((max, s) => (s.order > max ? s.order : max), -Infinity);
    const targetOrder = maxOrder === -Infinity ? 0 : maxOrder + 1;

    const updates: Record<string, any> = {};
    updates[`/songs/${song.id}/order`] = targetOrder;
    update(ref(db), updates).then(() => {
      showStatus('success', `ย้ายเพลง "${song.song.substring(0, 18)}..." ไปล่างสุดแล้ว`);
    });
  };

  // Clear completed history songs
  const clearCompletedHistory = () => {
    const completedSongs = songQueue.filter(item => item.status === 'completed');
    if (completedSongs.length === 0) {
      showStatus('error', 'ไม่มีประวัติเพลงที่เล่นแล้วให้ล้างครับ');
      return;
    }
    if (window.confirm(`ต้องการลบประวัติเพลงที่เล่นแล้วทั้งหมด (${completedSongs.length} เพลง) จริงหรือไม่?`)) {
      const updates: Record<string, any> = {};
      completedSongs.forEach(item => {
        updates[`/songs/${item.id}`] = null;
      });
      update(ref(db), updates).then(() => {
        showStatus('success', 'ล้างประวัติเพลงที่เล่นเสร็จแล้วทั้งหมดเรียบร้อย');
      });
    }
  };

  // Mark all pending songs as completed
  const markAllPendingAsCompleted = () => {
    const pendingSongs = songQueue.filter(item => item.status === 'pending');
    if (pendingSongs.length === 0) {
      showStatus('error', 'ไม่มีเพลงค้างรอเปิดครับ');
      return;
    }
    if (window.confirm(`ต้องการปรับสถานะเพลงที่รอเปิดทั้งหมด (${pendingSongs.length} เพลง) ให้เป็น "เล่นแล้ว" ใช่หรือไม่?`)) {
      const updates: Record<string, any> = {};
      pendingSongs.forEach(item => {
        updates[`/songs/${item.id}/status`] = 'completed';
      });
      update(ref(db), updates).then(() => {
        showStatus('success', 'ปรับสถานะเพลงทั้งหมดเรียบร้อยแล้ว');
      });
    }
  };

  // Remove Song permanently
  const removeQueuePermanently = (id: string, isCurrentlyPlaying = false) => {
    if (window.confirm('คุณต้องการลบคิวเพลงนี้ออกจากระบบคลาวด์ใช่หรือไม่?')) {
      if (isCurrentlyPlaying) {
        if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
          playerRef.current.stopVideo();
        }
        setPlayingVideoId(null);
        setPlayingSongTitle("ยังไม่ได้เลือกเพลง");
        setPlayingQueueId(null);
        setHasPlayerError(false);
        playerRef.current = null;
      }
      remove(ref(db, `songs/${id}`));
    }
  };

  // Clear all database entries
  const clearAllQueue = () => {
    if (window.confirm('ต้องการล้างคิวเพลงทั้งหมดออกจากฐานข้อมูลจริงหรือไม่? ข้อมูลนี้จะไม่สามารถกู้คืนได้')) {
      set(songsRef, null).then(() => {
        closeVideoPlayer();
        showStatus('success', 'ล้างคิวเพลงทั้งหมดสำเร็จแล้ว');
      });
    }
  };

  // DJ Recommended Playlists Helpers
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const cleanName = newCategoryName.trim();
    const id = 'category-' + Date.now();
    
    const categoryRef = ref(db, `recommended_categories/${id}`);
    set(categoryRef, {
      id,
      name: cleanName
    }).then(() => {
      setNewCategoryName("");
      setSelectedCategoryForEdit(id);
      showStatus('success', `📁 สร้างหมวดหมู่ "${cleanName}" สำเร็จ!`);
    }).catch(err => {
      showStatus('error', `เกิดข้อผิดพลาด: ${err.message}`);
    });
  };

  const handleDeleteCategory = (catId: string) => {
    if (Object.keys(recommendedCategories).length <= 1) {
      showStatus('error', '❌ ไม่สามารถลบหมวดหมู่ทั้งหมดได้ ต้องเหลืออย่างน้อย 1 หมวดหมู่');
      return;
    }
    const catName = recommendedCategories[catId]?.name || 'หมวดหมู่นี้';
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่ "${catName}" และเพลงทั้งหมดในหมวดหมู่นี้?`)) {
      return;
    }

    const updates: Record<string, any> = {};
    updates[`recommended_categories/${catId}`] = null;
    
    // If deleted category is active, reset active to another one
    if (activeCategoryId === catId) {
      const remainingKeys = Object.keys(recommendedCategories).filter(k => k !== catId);
      updates['settings/active_recommended_category_id'] = remainingKeys[0] || '';
    }

    update(ref(db), updates).then(() => {
      showStatus('success', `🗑️ ลบหมวดหมู่ "${catName}" สำเร็จ!`);
      const remainingKeys = Object.keys(recommendedCategories).filter(k => k !== catId);
      setSelectedCategoryForEdit(remainingKeys[0] || '');
    }).catch(err => {
      showStatus('error', `เกิดข้อผิดพลาด: ${err.message}`);
    });
  };

  const handleAddSongToCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSongTitle.trim() || !newSongUrl.trim()) {
      showStatus('error', '⚠️ กรุณากรอกทั้งชื่อเพลงและลิงก์ YouTube');
      return;
    }

    const videoId = extractYouTubeId(newSongUrl.trim());
    if (!videoId) {
      showStatus('error', '⚠️ ลิงก์ YouTube ไม่ถูกต้อง กรุณาใช้ลิงก์จาก YouTube เท่านั้น');
      return;
    }

    const songId = 'song-' + Date.now();
    const songRef = ref(db, `recommended_categories/${selectedCategoryForEdit}/songs/${songId}`);
    
    set(songRef, {
      id: songId,
      song: newSongTitle.trim(),
      url: newSongUrl.trim(),
      videoId: videoId
    }).then(() => {
      setNewSongTitle("");
      setNewSongUrl("");
      showStatus('success', `➕ เพิ่มเพลง "${newSongTitle}" ลงในเพลย์ลิสต์สำเร็จ!`);
    }).catch(err => {
      showStatus('error', `เกิดข้อผิดพลาด: ${err.message}`);
    });
  };

  const handleDeleteSongFromCategory = (catId: string, songId: string) => {
    const songName = recommendedCategories[catId]?.songs?.[songId]?.song || 'เพลงนี้';
    const songRef = ref(db, `recommended_categories/${catId}/songs/${songId}`);
    
    remove(songRef).then(() => {
      showStatus('success', `🗑️ ลบเพลง "${songName}" ออกแล้ว`);
    }).catch(err => {
      showStatus('error', `เกิดข้อผิดพลาด: ${err.message}`);
    });
  };

  const handleSetActiveCategory = (catId: string) => {
    const activeRef = ref(db, 'settings/active_recommended_category_id');
    set(activeRef, catId).then(() => {
      showStatus('success', `📌 ตั้งค่าเพลย์ลิสต์สลับอัตโนมัติเป็น "${recommendedCategories[catId]?.name}" สำเร็จ!`);
    }).catch(err => {
      showStatus('error', `เกิดข้อผิดพลาด: ${err.message}`);
    });
  };

  // Search Song via YouTube v3 API
  const searchSongList = async () => {
    const query = searchQuery.trim();
    if (!query) {
      showStatus('error', 'กรุณากรอกชื่อเพลงหรือชื่อนักร้องเพื่อค้นหาครับ');
      return;
    }

    // Direct YouTube link detected
    const ytId = extractYouTubeId(query);
    if (ytId) {
      const directUrl = `https://www.youtube.com/watch?v=${ytId}`;
      setSelectedVideoUrl(directUrl);
      setYoutubeSearchResults([
        {
          id: ytId,
          title: `ลิงก์ตรง YouTube (ID: ${ytId})`,
          channelTitle: "ระบบตรวจจับลิงก์ตรง",
          thumbnailUrl: `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`,
          duration: "วิดีโอตรง"
        }
      ]);
      setShowSearchResults(true);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);
    setYoutubeSearchResults([]);

    try {
      const searchApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(query)}&type=video&key=${YT_API_KEY}`;
      const response = await fetch(searchApiUrl);
      const data = await response.json();
      const items = data.items;

      if (!items || items.length === 0) {
        setIsSearching(false);
        return;
      }

      const videoIds = items.map((item: any) => item.id.videoId).join(',');
      const detailsApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${YT_API_KEY}`;
      
      const detailsRes = await fetch(detailsApiUrl);
      const detailsData = await detailsRes.json();

      const results: YouTubeSearchResult[] = items.map((item: any) => {
        const videoId = item.id.videoId;
        const matchedDetail = detailsData.items?.find((d: any) => d.id === videoId);
        const rawDuration = matchedDetail ? matchedDetail.contentDetails.duration : '';
        const formattedDuration = formatISO8601Duration(rawDuration);

        return {
          id: videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnailUrl: item.snippet.thumbnails.default?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          duration: formattedDuration
        };
      });

      setYoutubeSearchResults(results);
    } catch (error) {
      console.error("YouTube search error: ", error);
      showStatus('error', 'การค้นหาบน YouTube ขัดข้อง กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSearching(false);
    }
  };

  // Submit requested song to database
  const submitSongRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) {
      showStatus('error', 'กรุณาระบุหมายเลขโต๊ะของคุณก่อนครับ');
      return;
    }

    let songName = searchQuery.trim();
    let videoUrl = selectedVideoUrl;
    const timestamp = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    const ytId = extractYouTubeId(songName);
    if (ytId) {
      videoUrl = `https://www.youtube.com/watch?v=${ytId}`;
      songName = `เพลงจากลิงก์ YouTube (ID: ${ytId})`;
    } else if (!videoUrl) {
      // Fallback search link if no video was selected explicitly
      videoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(songName)}`;
    }

    const maxOrder = songQueue.reduce((max, item) => (item.order > max ? item.order : max), 0);

    const newRequest = {
      table: selectedTable,
      song: songName,
      url: videoUrl,
      time: timestamp,
      status: 'pending',
      order: maxOrder + 1
    };

    push(songsRef, newRequest).then(() => {
      showStatus('success', `ส่งเพลง "${songName.length > 30 ? songName.substring(0, 30) + '...' : songName}" ไปยังดีเจแล้ว!`);
      setSearchQuery('');
      setSelectedVideoUrl('');
      setShowSearchResults(false);
      setYoutubeSearchResults([]);
    }).catch(err => {
      showStatus('error', 'ส่งเพลงไม่สำเร็จ กรุณาลองอีกครั้ง');
      console.error(err);
    });
  };

  // Helper helper to show glowing brief status alerts
  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatusAlert({ type, message });
    setTimeout(() => {
      setStatusAlert(null);
    }, 4000);
  };

  // Password submission for DJ mode
  const verifyDjPassword = () => {
    if (passwordInput === DJ_PASSWORD) {
      setCurrentPage('dj');
      setIsPasswordModalOpen(false);
      setPasswordError("");
      setPasswordInput("");
      showStatus('success', 'เข้าสู่หน้าควบคุมคิวเพลงของดีเจแล้ว!');
    } else {
      setPasswordError("รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
    }
  };

  // Copy link helper
  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Create table dropdown options 1-30
  const tables = Array.from({ length: 30 }, (_, i) => i + 1);

  // Filter songs according to admin filters
  const filteredAdminSongs = React.useMemo(() => {
    let baseSongs = songQueue.filter(item => item.status === currentTab);

    // If pending tab & Table-Fair mode is ON, sort using the fair algorithm
    if (currentTab === 'pending' && isTableFairSort) {
      baseSongs = getTableFairSortedSongs(baseSongs);
    }

    // Filter by table
    if (adminTableFilter !== 'all') {
      baseSongs = baseSongs.filter(item => String(item.table) === adminTableFilter);
    }

    // Filter by search query
    if (djSearchQuery.trim()) {
      const q = djSearchQuery.toLowerCase();
      baseSongs = baseSongs.filter(item => 
        item.song.toLowerCase().includes(q) || 
        String(item.table).includes(q)
      );
    }

    return baseSongs;
  }, [songQueue, currentTab, isTableFairSort, adminTableFilter, djSearchQuery]);

  // Compute active tables that have pending requests
  const activeRequestTables = React.useMemo(() => {
    const counts: Record<string, number> = {};
    songQueue.filter(item => item.status === 'pending').forEach(item => {
      counts[item.table] = (counts[item.table] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([table, count]) => ({ table, count }))
      .sort((a, b) => b.count - a.count); // sort by count descending
  }, [songQueue]);

  // Find top requested table for statistics
  const topRequestedTable = activeRequestTables[0] || null;

  // Calculate tabs counters
  const pendingCount = songQueue.filter(item => item.status === 'pending' && (adminTableFilter === 'all' || String(item.table) === adminTableFilter)).length;
  const playingCount = songQueue.filter(item => item.status === 'playing' && (adminTableFilter === 'all' || String(item.table) === adminTableFilter)).length;
  const completedCount = songQueue.filter(item => item.status === 'completed' && (adminTableFilter === 'all' || String(item.table) === adminTableFilter)).length;

  // Active playing song overall
  const activePlayingSong = songQueue.find(item => item.status === 'playing');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased relative overflow-x-hidden selection:bg-emerald-500 selection:text-white pb-10">
      
      {/* Dynamic atmospheric mesh background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-10 left-[-100px] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* Modern Header Navigation */}
      <header className="sticky top-0 z-40 bg-slate-900/75 backdrop-blur-md border-b border-slate-800/80 shadow-xl transition-all">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentPage('landing')}>
            <div className="p-2 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-lg shadow-emerald-500/20 text-slate-950">
              <Music className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent tracking-wide">
                ร้านนี้...อยากฟังเพลงอะไร<span className="text-white font-light ml-1">ขอมา!</span>
              </h1>
              <p className="text-[10px] md:text-xs text-slate-400 font-light flex items-center gap-1 mt-0.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                ระบบ Real-time คลาวด์ ซิงค์คิวเพลงอัตโนมัติ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentPage !== 'landing' && (
              <button
                onClick={() => setCurrentPage('landing')}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium py-2 px-3.5 rounded-full text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                กลับหน้าแรก
              </button>
            )}

            {currentPage === 'customer' && (
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-100 font-medium py-2 px-4 rounded-full text-xs transition-all flex items-center gap-1.5 shadow-md hover:border-amber-500/40 cursor-pointer active:scale-95"
              >
                <UserCog className="w-4 h-4 text-amber-400" />
                สลับไปหน้าดีเจ
              </button>
            )}

            {currentPage === 'dj' && (
              <button
                onClick={() => setCurrentPage('customer')}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium py-2 px-4 rounded-full text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-95"
              >
                <UserRound className="w-4 h-4" />
                หน้าขอเพลงลูกค้า
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 md:py-10 relative z-10">
        
        {/* Real-time Status Floating Alerts */}
        {statusAlert && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 transition-all duration-300">
            <div className={`p-4 rounded-2xl shadow-2xl border flex items-center gap-3 ${
              statusAlert.type === 'success' 
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' 
                : 'bg-rose-950/90 border-rose-500/30 text-rose-300'
            }`}>
              {statusAlert.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <p className="text-xs md:text-sm font-medium">{statusAlert.message}</p>
            </div>
          </div>
        )}

        {/* ==================== 1. LANDING/ROUTER LOBBY SCREEN ==================== */}
        {currentPage === 'landing' && (
          <div className="max-w-4xl mx-auto py-8 md:py-16 space-y-10 text-center">
            
            {/* Visual Header Branding */}
            <div className="space-y-4">
              <div className="inline-flex p-4 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-3xl shadow-2xl shadow-emerald-500/25 text-slate-950 mb-4 animate-pulse">
                <Music className="w-10 h-10 md:w-12 md:h-12 animate-bounce" style={{ animationDuration: '3s' }} />
              </div>
              <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-tight">
                ยินดีต้อนรับสู่ Music Request
              </h2>
              <p className="text-sm md:text-lg text-slate-400 max-w-xl mx-auto font-light">
                ระบบจัดการคิวเพลงสำหรับร้านค้า คาเฟ่ และบาร์ยุคใหม่ ค้นหาเพลงผ่าน YouTube และส่งเข้าบอร์ดดีเจทันทีแบบ Real-time
              </p>
            </div>

            {/* Split Page Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto pt-6">
              
              {/* Option 1: Customer Card */}
              <div
                className="glass-panel rounded-3xl border border-slate-800 hover:border-emerald-500/40 p-8 text-left relative overflow-hidden group cursor-pointer transition-all duration-300 flex flex-col justify-between h-[280px] hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-2xl hover:shadow-emerald-500/10"
                onClick={() => setCurrentPage('customer')}
              >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400"></div>
                <div className="absolute right-[-20px] bottom-[-20px] text-emerald-500/5 group-hover:text-emerald-500/10 text-9xl transition-all duration-500 pointer-events-none">
                  <UserRound />
                </div>
                
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl w-fit border border-emerald-500/20 group-hover:scale-110 transition-transform">
                    <UserRound className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                      หน้าขอเพลงลูกค้า
                    </h3>
                    <p className="text-xs md:text-sm text-slate-400 font-light mt-1.5 leading-relaxed">
                      เลือกหมายเลขโต๊ะของคุณ พิมพ์ค้นหาและจัดส่งลิ้งก์วิดีโอจาก YouTube ตรงสู่ดีเจ พร้อมแสดงสถานะคิวรอเล่นเรียลไทม์
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-emerald-400 group-hover:translate-x-1.5 transition-transform">
                  เข้าสู่ห้องขอเพลง <span className="text-base">&rarr;</span>
                </div>
              </div>

              {/* Option 2: DJ Panel Card */}
              <div
                className="glass-panel rounded-3xl border border-slate-800 hover:border-amber-500/40 p-8 text-left relative overflow-hidden group cursor-pointer transition-all duration-300 flex flex-col justify-between h-[280px] hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-2xl hover:shadow-amber-500/10"
                onClick={() => setIsPasswordModalOpen(true)}
              >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 to-amber-600"></div>
                <div className="absolute right-[-20px] bottom-[-20px] text-amber-500/5 group-hover:text-amber-500/10 text-9xl transition-all duration-500 pointer-events-none">
                  <UserCog />
                </div>

                <div className="space-y-4">
                  <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl w-fit border border-amber-500/20 group-hover:scale-110 transition-transform">
                    <UserCog className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                      แผงดีเจควบคุมคิว
                    </h3>
                    <p className="text-xs md:text-sm text-slate-400 font-light mt-1.5 leading-relaxed">
                      ระบบคิวสำหรับดีเจ เครื่องเล่น YouTube ฝังในตัวแบบรีไซน์ คีย์บอร์ดเปลี่ยนลำดับคิว และควบคุมความเคลื่อนไหว (มีระบบรหัสผ่าน)
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-amber-400 group-hover:translate-x-1.5 transition-transform">
                  เข้าสู่บอร์ดดีเจ <span className="text-base">&rarr;</span>
                </div>
              </div>

            </div>

            {/* General Information / Notice footer */}
            <div className="text-slate-600 text-xs font-light max-w-md mx-auto pt-8 flex items-center justify-center gap-1">
              <Info className="w-4 h-4 shrink-0" />
              <span>แนะนำเปิดหน้าขอเพลงในมือถือ และหน้าดีเจบนหน้าจอคอมพิวเตอร์</span>
            </div>

          </div>
        )}

        {/* ==================== 2. CUSTOMER VIEW SCREEN ==================== */}
        {currentPage === 'customer' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            
            {/* 🎵 NOW PLAYING HEADER BAR */}
            <div className="glass-panel rounded-3xl border border-slate-800 p-4 md:p-6 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="absolute top-0 left-0 w-1 md:w-auto md:h-full md:w-1.5 bg-gradient-to-b from-rose-500 to-amber-500 h-full rounded-l-3xl"></div>
              
              <div className="flex items-center gap-4 w-full md:w-auto min-w-0">
                {/* Visual Spin Vinyl disc */}
                <div className="relative shrink-0">
                  <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center relative shadow-xl overflow-hidden ${activePlayingSong ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }}>
                    <div className="absolute inset-0 border border-white/5 rounded-full scale-[0.8]"></div>
                    <div className="absolute inset-0 border border-white/5 rounded-full scale-[0.6]"></div>
                    <div className="absolute inset-0 border border-white/5 rounded-full scale-[0.4]"></div>
                    <div className="w-4 h-4 rounded-full bg-slate-950 border border-slate-800 z-10 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                    </div>
                  </div>
                  {activePlayingSong && (
                    <div className="absolute -bottom-1 -right-1 bg-rose-500 text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider text-white animate-pulse">
                      Live
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                    ขณะนี้กำลังเปิดเพลง
                  </span>
                  <h3 className="text-sm md:text-lg font-bold text-slate-100 truncate mt-1">
                    {activePlayingSong ? activePlayingSong.song : "ยังไม่ได้เลือกเพลง / ดีเจกำลังเตรียมเปิดเพลง"}
                  </h3>
                  {activePlayingSong && (
                    <p className="text-[10px] md:text-xs text-slate-400 mt-0.5 font-light flex items-center gap-1">
                      <Armchair className="w-3.5 h-3.5 text-emerald-400" />
                      ส่งมาจาก โต๊ะที่ {activePlayingSong.table} &bull; <Clock className="w-3 h-3 text-slate-500" /> ขอเมื่อ {activePlayingSong.time} น.
                    </p>
                  )}
                </div>
              </div>

              {/* Dynamic Sound Equalizer Animation */}
              {activePlayingSong ? (
                <div className="flex items-end gap-1 h-8 shrink-0 py-1 px-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
                  <span className="w-1 bg-emerald-500 rounded-t animate-bounce" style={{ height: '40%', animationDelay: '0.1s', animationDuration: '0.7s' }}></span>
                  <span className="w-1 bg-emerald-400 rounded-t animate-bounce" style={{ height: '80%', animationDelay: '0.3s', animationDuration: '0.9s' }}></span>
                  <span className="w-1 bg-teal-400 rounded-t animate-bounce" style={{ height: '55%', animationDelay: '0.5s', animationDuration: '0.6s' }}></span>
                  <span className="w-1 bg-emerald-400 rounded-t animate-bounce" style={{ height: '90%', animationDelay: '0.2s', animationDuration: '0.8s' }}></span>
                  <span className="w-1 bg-emerald-500 rounded-t animate-bounce" style={{ height: '30%', animationDelay: '0.4s', animationDuration: '0.5s' }}></span>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic shrink-0 font-light flex items-center gap-1.5 bg-slate-900/50 py-1.5 px-3 rounded-xl border border-slate-800">
                  <Volume2 className="w-4 h-4 text-slate-600" />
                  รอสัญญาณเพลงถัดไป...
                </div>
              )}
            </div>

            {/* 📬 SUBMIT SONG REQUEST BOX */}
            <div className="glass-panel border border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600"></div>
              
              <h2 className="text-lg md:text-xl font-bold mb-6 text-center text-slate-100 flex items-center justify-center gap-2">
                <Music className="w-5 h-5 text-emerald-400" />
                ส่งคำขอเพลงของคุณเข้าสู่ดีเจบอร์ด
              </h2>

              <form onSubmit={submitSongRequest} className="space-y-5 relative">
                {/* 1. TABLE NO SELECTION */}
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                    <Armchair className="w-4 h-4 text-emerald-400" />
                    หมายเลขโต๊ะของคุณ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="tableNo"
                    required
                    value={selectedTable}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedTable(val);
                      setCustomerTableFilter(val);
                    }}
                    className="w-full bg-slate-900/80 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer font-medium"
                  >
                    <option value="" className="text-slate-500">-- กรุณาเลือกโต๊ะของคุณ --</option>
                    {tables.map(num => (
                      <option key={num} value={num} className="bg-slate-900 text-slate-100">
                        โต๊ะที่ {num}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. SEARCH SONG INPUT WITH REAL-TIME SUGGESTIONS */}
                <div className="relative">
                  <label className="block text-xs md:text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                    <Search className="w-4 h-4 text-emerald-400" />
                    ชื่อเพลง หรือ ชื่อศิลปิน <span className="text-rose-500">*</span>
                  </label>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        required
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          if (selectedVideoUrl) setSelectedVideoUrl('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            searchSongList();
                          }
                        }}
                        placeholder="พิมพ์ชื่อเพลง หรือ วางลิงก์ YouTube ตรงได้ที่นี่..."
                        className="w-full bg-slate-900/80 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-4 pr-10 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder-slate-500 font-medium"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery("");
                            setSelectedVideoUrl("");
                            setYoutubeSearchResults([]);
                            setShowSearchResults(false);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    <button
                      type="button"
                      onClick={searchSongList}
                      className="bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-white font-medium py-3 px-5 rounded-xl transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer text-xs md:text-sm active:scale-95"
                    >
                      <Search className="w-4 h-4 text-emerald-400" />
                      ค้นหาบน YouTube
                    </button>
                  </div>

                  {/* YouTube Search Results Dropdown Popover */}
                  {showSearchResults && (
                    <div
                      className="absolute w-full mt-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-slate-800/60 shadow-2xl z-50 transition-all duration-200"
                    >
                      {isSearching ? (
                        <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                          <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
                          <span>กำลังดึงข้อมูลเพลงจากระบบ YouTube API...</span>
                        </div>
                      ) : youtubeSearchResults.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500 italic">
                          ไม่พบผลการค้นหา กรุณาลองปรับชื่อเพลงใหม่อีกครั้ง
                        </div>
                      ) : (
                        youtubeSearchResults.map((song) => (
                          <div
                            key={song.id}
                            onClick={() => {
                              setSearchQuery(song.title);
                              setSelectedVideoUrl(`https://www.youtube.com/watch?v=${song.id}`);
                              setShowSearchResults(false);
                            }}
                            className="p-3 flex items-center justify-between gap-3 hover:bg-slate-800/50 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <img
                                src={song.thumbnailUrl}
                                className="w-14 h-9 md:w-16 md:h-10 object-cover rounded-lg border border-slate-800 shrink-0 shadow-md group-hover:border-emerald-500/50 transition-colors"
                                alt="YouTube Cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs md:text-sm font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors truncate">
                                  <span className="text-[9px] text-emerald-400 font-bold border border-emerald-500/30 rounded px-1.5 py-0.2 mr-1">เพลง</span>
                                  {song.title}
                                </p>
                                <div className="flex items-center gap-2.5 mt-0.5 text-[10px] text-slate-400">
                                  <span className="truncate">โดย: <span className="text-slate-300">{song.channelTitle}</span></span>
                                  <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded font-mono shrink-0 flex items-center gap-0.5 scale-90">
                                    {song.duration}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="bg-slate-950 border border-slate-800 group-hover:bg-emerald-500 group-hover:text-slate-950 group-hover:border-emerald-400 text-slate-300 text-[10px] md:text-xs font-semibold py-1.5 px-3 rounded-lg transition-all shrink-0"
                            >
                              เลือกเพลงนี้
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Submitting indicator if direct URL selected */}
                {selectedVideoUrl && !showSearchResults && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center gap-2 text-xs text-emerald-400 animate-pulse">
                    <CheckCircle className="w-4 h-4" />
                    <span>ล็อกอินลิงก์สตรีม YouTube แล้วเรียบร้อย พร้อมส่งคำขอแล้ว!</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold py-4 px-4 rounded-xl transition-all shadow-xl shadow-emerald-500/15 active:scale-[0.99] cursor-pointer text-sm md:text-base flex items-center justify-center gap-2"
                >
                  <Music className="w-5 h-5" />
                  ส่งคิวเพลงเข้าสู่ระบบ
                </button>
              </form>

              {/* 💡 HELPFUL STREAMING EXPLANATION */}
              <div className="mt-5 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-indigo-300 text-[11px] md:text-xs flex gap-3 leading-relaxed animate-fadeIn">
                <Info className="w-4.5 h-4.5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-indigo-200">💡 ทำไมเพลงที่ส่งถึงไม่เล่นทันที?</p>
                  <ul className="list-disc list-inside space-y-1 text-indigo-300/90 font-light">
                    <li><strong>คิวเพลงตามลำดับ:</strong> หากมีเพลงอื่นกำลังเล่นอยู่ เพลงใหม่จะถูกจัดคิวรอเล่นตามลำดับ (Pending) เพื่อป้องกันการตัดเพลงหรือเสียงขาดตอนระหว่างร้อง</li>
                    <li><strong>ดีเจยังไม่ได้เปิดสตรีม:</strong> เครื่องเล่นวิดีโอและระบบเสียง YouTube จะทำงานเมื่อมีคนเปิด <strong>"แผงดีเจควบคุมคิว" (DJ Control Panel)</strong> ทิ้งไว้บนทีวีหรือหน้าจอของร้าน หากไม่มีดีเจเปิดหน้านั้นไว้ คิวเพลงจะบันทึกรอยบนคลาวด์อย่างปลอดภัยจนกว่าหน้าดีเจจะเริ่มเล่นครับ</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 📋 TABLE QUEUE MONITOR */}
            <div className="glass-panel border border-slate-800/80 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
                <h3 className="text-sm md:text-base font-bold text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  คิวเพลงประจำโต๊ะของคุณ
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400">เลือกดูคิวโต๊ะ:</span>
                  <select
                    value={customerTableFilter}
                    onChange={(e) => setCustomerTableFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer min-w-[120px]"
                  >
                    <option value="none">-- เลือกโต๊ะ --</option>
                    {tables.map(num => (
                      <option key={num} value={num}>โต๊ะที่ {num}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {customerTableFilter === 'none' || !customerTableFilter ? (
                  <div className="text-center py-10 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                    <Armchair className="w-8 h-8 text-slate-800" />
                    <span>กรุณาเลือกหมายเลขโต๊ะของคุณด้านบน เพื่อตรวจสอบคิวสถานะเพลง</span>
                  </div>
                ) : (
                  (() => {
                    const tableRequests = songQueue.filter(item => String(item.table) === String(customerTableFilter));
                    const allPending = songQueue.filter(item => item.status === 'pending');

                    if (tableRequests.length === 0) {
                      return (
                        <div className="text-center py-10 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                          <Info className="w-6 h-6 text-slate-700" />
                          <span>โต๊ะที่ {customerTableFilter} ยังไม่มีการขอเพลงใดๆ ในคืนนี้</span>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2.5">
                        {tableRequests.map((item) => {
                          let badgeStyle = "";
                          let badgeText = "";
                          
                          if (item.status === 'pending') {
                            const queuePos = allPending.findIndex(p => p.id === item.id) + 1;
                            badgeStyle = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                            badgeText = `⏳ รอเล่น (คิวร้าน #${queuePos})`;
                          } else if (item.status === 'playing') {
                            badgeStyle = "bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse font-bold";
                            badgeText = "🔴 กำลังเล่น";
                          } else {
                            badgeStyle = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                            badgeText = "✅ เปิดเรียบร้อย";
                          }

                          return (
                            <div
                              key={item.id}
                              className="p-3 bg-slate-900/40 border border-slate-800/50 rounded-2xl flex items-center justify-between gap-3 shadow-inner hover:border-slate-800 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs md:text-sm font-semibold text-slate-200 truncate">{item.song}</p>
                                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-light">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  ขอเวลา {item.time} น.
                                </p>
                              </div>
                              <span className={`text-[10px] px-2.5 py-1 rounded-full shrink-0 font-medium ${badgeStyle}`}>
                                {badgeText}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

          </div>
        )}

        {/* ==================== 3. DJ / ADMIN VIEW SCREEN ==================== */}
        {currentPage === 'dj' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* 🌟 PREMIUM MODERN STATS & CONTROLS DASHBOARD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Stat 1: Queue Status */}
              <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/40 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
                  <Music className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">คิวเพลงรอเปิด</p>
                  <p className="text-xl font-bold text-amber-400">{songQueue.filter(s => s.status === 'pending').length} เพลง</p>
                </div>
              </div>

              {/* Stat 2: Sorting Mode */}
              <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/40 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${isTableFairSort ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">รูปแบบการจัดคิว</p>
                  <p className="text-xs font-bold text-slate-200 mt-1 truncate max-w-[150px]">
                    {isTableFairSort ? 'เฉลี่ยรายโต๊ะ (Fair)' : 'ลำดับปกติ (First-In)'}
                  </p>
                </div>
              </div>

              {/* Stat 3: Hot Table */}
              <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/40 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
                  <Armchair className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">โต๊ะที่ขอเพลงมากสุด</p>
                  <p className="text-xs font-bold text-slate-200 mt-1 truncate max-w-[150px]">
                    {topRequestedTable ? `โต๊ะที่ ${topRequestedTable.table} (${topRequestedTable.count} เพลง)` : 'ไม่มีคิวค้าง'}
                  </p>
                </div>
              </div>

              {/* Stat 4: Automation Status */}
              <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/40 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${isAutoPlayEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  <Tv className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">ระบบเล่นเพลงอัตโนมัติ</p>
                  <p className="text-xs font-bold text-slate-200 mt-1">
                    {isAutoPlayEnabled ? '🟢 เปิด (Auto-Play)' : '⚪ ควบคุมเอง'}
                  </p>
                </div>
              </div>
            </div>

            {/* 🛠️ ADVANCED CONTROLS PANEL */}
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 bg-slate-900/30 space-y-5">
              
              <div className="flex flex-col md:flex-row gap-5 items-start md:items-center justify-between pb-4 border-b border-slate-800/60">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    แผงควบคุมระบบเสียงและคิวอัจฉริยะ (DJ Admin Console)
                  </h3>
                  <p className="text-xs text-slate-400">ควบคุมการเล่นและจัดระเบียบตัวช่วยสลับเพลงสำหรับดีเจร้านอาหารและสถานบันเทิง</p>
                </div>
                
                {/* Auto Actions Menu */}
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <button
                    onClick={markAllPendingAsCompleted}
                    className="text-[11px] bg-emerald-500/10 hover:bg-emerald-600 text-emerald-400 hover:text-slate-950 border border-emerald-500/20 py-1.5 px-3 rounded-xl transition-all font-semibold cursor-pointer active:scale-95 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> ปรับเป็นเล่นแล้วทั้งหมด
                  </button>
                  <button
                    onClick={clearCompletedHistory}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-1.5 px-3 rounded-xl transition-all font-semibold cursor-pointer active:scale-95 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> ล้างประวัติที่เปิดแล้ว
                  </button>
                  <button
                    onClick={clearAllQueue}
                    className="text-[11px] bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/20 py-1.5 px-3 rounded-xl transition-all font-semibold cursor-pointer active:scale-95 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> ล้างคิวเพลงทั้งหมด
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Toggles (Table Fair & Auto Play) */}
                <div className="space-y-3.5 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">ตั้งค่าระบบคิว</h4>
                  
                  {/* Fair Sort Switch */}
                  <div className="flex items-center justify-between gap-4 p-2 hover:bg-slate-900/50 rounded-xl transition-all">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">ระบบเฉลี่ยคิวเพลงรายโต๊ะ (Table-Fair Queue)</span>
                      <span className="text-[10px] text-slate-400">สลับคิวเพลงให้ทุกโต๊ะได้ฟังเท่าเทียมกัน (Round-Robin) ป้องกันโต๊ะเดียวจองคิวยาว</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={isTableFairSort}
                        onChange={(e) => setIsTableFairSort(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* Auto Play Switch */}
                  <div className="flex items-center justify-between gap-4 p-2 hover:bg-slate-900/50 rounded-xl transition-all">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">ระบบเล่นเพลงถัดไปอัตโนมัติ (Auto-Play Next)</span>
                      <span className="text-[10px] text-slate-400">เมื่อเล่นเพลงปัจจุบันจบ ระบบจะสตรีมเพลงถัดไปในคิวเข้าสู่ทีวีทันที</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={isAutoPlayEnabled}
                        onChange={(e) => setIsAutoPlayEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>

                {/* Filters (Search & Tables) */}
                <div className="space-y-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">ค้นหาคิวและตัวกรอง</h4>
                    
                    {/* Search Queue Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="พิมพ์ค้นหาคิวเพลง เช่น ชื่อเพลง, เลขโต๊ะ..."
                        value={djSearchQuery}
                        onChange={(e) => setDjSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-500"
                      />
                    </div>
                  </div>

                  {/* Filter by table dropdown */}
                  <div className="pt-2">
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                      เลือกกรองแยกตามโต๊ะ (หรือพิมพ์ค้นหาได้ด้านบน):
                    </label>
                    <select
                      value={adminTableFilter}
                      onChange={(e) => setAdminTableFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                    >
                      <option value="all">แสดงคิวรวมจากทุกโต๊ะ (ทั้งหมด)</option>
                      {tables.map(num => (
                        <option key={num} value={num}>แสดงเฉพาะ "โต๊ะที่ {num}"</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>

              {/* 📊 NEW COMPACT QUICK TABLE FILTER BADGES */}
              {activeRequestTables.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800/40">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    โต๊ะที่กำลังรอเพลงอยู่ (กดคลิกเพื่อกรองโต๊ะ):
                  </span>
                  <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 max-w-full">
                    <button
                      onClick={() => setAdminTableFilter('all')}
                      className={`text-[11px] py-1 px-3 rounded-full border transition-all cursor-pointer font-semibold ${
                        adminTableFilter === 'all'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-400 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      ทั้งหมด (All)
                    </button>
                    {activeRequestTables.map(({ table, count }) => (
                      <button
                        key={table}
                        onClick={() => setAdminTableFilter(String(table))}
                        className={`text-[11px] py-1 px-3 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${
                          adminTableFilter === String(table)
                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span>โต๊ะ {table}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                          adminTableFilter === String(table) ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Split layout: Video player and Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: ACTIVE VIDEO STREAM & PLAYERS */}
              <div className="lg:col-span-7 space-y-4 lg:sticky lg:top-24 z-20">
                <div className="glass-panel p-4 md:p-6 rounded-3xl border border-slate-800 shadow-2xl space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
                    <span className="text-xs md:text-sm font-semibold text-rose-400 flex items-center gap-2 min-w-0 flex-1">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                      </span>
                      <span className="truncate text-slate-300">
                        กำลังสตรีม: <span className="text-white font-bold">{playingSongTitle}</span>
                      </span>
                    </span>
                    
                    {playingVideoId && (
                      <button
                        onClick={closeVideoPlayer}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-lg transition-all cursor-pointer shrink-0 ml-2 border border-slate-700 hover:border-rose-500/30"
                      >
                        <X className="w-3.5 h-3.5 inline mr-1" />
                        ปิดเครื่องเล่น
                      </button>
                    )}
                  </div>

                  {/* YouTube Iframe Sandbox Player Container */}
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-950 shadow-inner flex items-center justify-center">
                    <div id="youtube-player-element" className="w-full h-full">
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center gap-2">
                        <Tv className="w-12 h-12 text-slate-800 animate-pulse" />
                        <p className="text-sm font-semibold text-slate-400">สตรีมทีวีพร้อมทำงาน</p>
                        <p className="text-xs text-slate-500 max-w-sm">กดปุ่ม "เล่นในเว็บ" ในรายการคิวเพลงเพื่อเปิดวิดีโอ YouTube ของดีเจ</p>
                      </div>
                    </div>
                  </div>

                  {/* 📺 PREMIUM MEDIA CONTROLLER PANEL */}
                  {playingVideoId && (
                    <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl space-y-3 shadow-lg animate-fadeIn">
                      
                      {/* Timeline bar with time text */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                          <span>{formatTime(ytCurrentTime)}</span>
                          <span className="text-amber-400/90">{formatTime(ytDuration)}</span>
                        </div>
                        
                        {/* Interactive Progress Bar */}
                        <div 
                          onClick={handleProgressBarClick}
                          className="h-2 bg-slate-800 hover:bg-slate-700 rounded-full cursor-pointer relative overflow-hidden group transition-all"
                        >
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500 rounded-full absolute top-0 left-0"
                            style={{ width: `${ytDuration ? (ytCurrentTime / ytDuration) * 100 : 0}%` }}
                          />
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg border border-slate-300"
                            style={{ left: `calc(${ytDuration ? (ytCurrentTime / ytDuration) * 100 : 0}% - 7px)` }}
                          />
                        </div>
                      </div>

                      {/* Actions row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        
                        {/* Control buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={seekBackward}
                            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 cursor-pointer active:scale-95 transition-all"
                            title="ย้อนหลัง 10 วินาที"
                          >
                            <SkipBack className="w-4 h-4" />
                          </button>

                          <button
                            onClick={togglePlayPause}
                            className={`p-2 rounded-xl cursor-pointer active:scale-95 transition-all flex items-center justify-center ${
                              isYtPlaying 
                                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-400/10' 
                                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/10'
                            }`}
                            title={isYtPlaying ? "หยุดเพลงชั่วคราว" : "เล่นเพลงต่อ"}
                          >
                            {isYtPlaying ? (
                              <Pause className="w-5 h-5 fill-slate-950" />
                            ) : (
                              <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
                            )}
                          </button>

                          <button
                            onClick={seekForward}
                            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 cursor-pointer active:scale-95 transition-all"
                            title="ข้ามไปข้างหน้า 10 วินาที"
                          >
                            <SkipForward className="w-4 h-4" />
                          </button>

                          <button
                            onClick={restartCurrentSong}
                            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 cursor-pointer active:scale-95 transition-all"
                            title="เริ่มเล่นใหม่ตั้งแต่ต้น"
                          >
                            <RotateCcw className="w-4 h-4 text-slate-400 hover:text-amber-400" />
                          </button>
                        </div>

                        {/* Volume Adjuster */}
                        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 min-w-[130px] max-w-[180px] flex-1">
                          <button
                            onClick={toggleMute}
                            className="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                            title={isYtMuted ? "เปิดเสียง" : "ปิดเสียง"}
                          >
                            {isYtMuted ? (
                              <VolumeX className="w-4 h-4 text-rose-500 animate-pulse" />
                            ) : (
                              <Volume2 className="w-4 h-4 text-emerald-400" />
                            )}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={isYtMuted ? 0 : ytVolume}
                            onChange={(e) => handleVolumeChange(Number(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 outline-none"
                            title="ความดัง"
                          />
                          <span className="text-[10px] text-slate-400 font-mono w-6 text-right">
                            {isYtMuted ? '0' : ytVolume}%
                          </span>
                        </div>

                        {/* Status badge */}
                        <div className="text-[10px] text-slate-400 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center gap-1.5 font-medium shrink-0">
                          <span className={`w-1.5 h-1.5 rounded-full ${isYtPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                          <span>{isYtPlaying ? 'กำลังเล่น' : 'หยุด'}</span>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* Copy Link / Action Fallbacks */}
                  {playingVideoId && (
                    <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>หากเครื่องเล่นติดขัดหรือติดลิขสิทธิ์:</span>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <a
                          href={`https://www.youtube.com/watch?v=${playingVideoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 sm:flex-none text-center bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold py-1.5 px-3 rounded-lg transition-all shadow-md flex items-center justify-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          เปิดบนเว็บหลัก
                        </a>
                        <button
                          onClick={() => {
                            if (playingQueueId) {
                              if (playingQueueId === 'autoplay-recommendation') {
                                handleSongEnded('autoplay-recommendation');
                              } else {
                                moveToStatus(playingQueueId, 'completed');
                              }
                            }
                          }}
                          className="flex-1 sm:flex-none text-center bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold py-1.5 px-3 rounded-lg transition-all border border-slate-700 cursor-pointer"
                        >
                          กดข้าม / ข้ามคิวนี้
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: QUEUE TABS & LISTS */}
              <div className="lg:col-span-5 space-y-4">
                <div className="glass-panel border border-slate-800 p-4 rounded-3xl shadow-xl space-y-4">
                  
                  {/* Tabs configuration: Pending, Playing, Completed */}
                  <div className="grid grid-cols-3 bg-slate-950 p-1.5 rounded-xl border border-slate-800/60">
                    <button
                      onClick={() => setCurrentTab('pending')}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                        currentTab === 'pending'
                          ? 'text-amber-400 bg-slate-900 border border-slate-800'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>รอเปิด</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 rounded-full font-black text-amber-400">
                        {pendingCount}
                      </span>
                    </button>

                    <button
                      onClick={() => setCurrentTab('playing')}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                        currentTab === 'playing'
                          ? 'text-rose-400 bg-slate-900 border border-slate-800'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>กำลังเล่น</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/20 rounded-full font-black text-rose-400">
                        {playingCount}
                      </span>
                    </button>

                    <button
                      onClick={() => setCurrentTab('completed')}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                        currentTab === 'completed'
                          ? 'text-emerald-400 bg-slate-900 border border-slate-800'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>เล่นแล้ว</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 rounded-full font-black text-emerald-400">
                        {completedCount}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Main scrollable Queue List */}
                <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                  {filteredAdminSongs.length === 0 ? (
                    <div className="text-center py-16 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800 flex flex-col items-center justify-center p-4">
                      <Music className="w-10 h-10 text-slate-800 mb-3" />
                      <p className="text-slate-400 text-xs font-medium">ไม่มีคิวเพลงในหมวดหมู่นี้...</p>
                      <p className="text-slate-600 text-[10px] mt-1 font-light">หรือข้อมูลกรองไม่ตรงกับคำค้นหาของคุณ</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredAdminSongs.map((item) => {
                        const trueIndex = songQueue.findIndex(s => s.id === item.id);
                        const ytId = extractYouTubeId(item.url);

                        let borderStyle = "border-slate-800 hover:border-slate-700";
                        let statusText = "คิว";
                        
                        if (item.status === 'playing') {
                          borderStyle = "border-rose-500/40 bg-rose-950/5";
                          statusText = "PLAYING";
                        } else if (item.status === 'completed') {
                          borderStyle = "border-emerald-500/30 bg-emerald-950/5";
                          statusText = "PLAYED";
                        }

                        return (
                          <div
                            key={item.id}
                            className={`p-3 bg-slate-900/60 rounded-2xl border ${borderStyle} flex flex-col gap-3 shadow-md transition-all relative group`}
                          >
                            <div className="flex items-center justify-between gap-3 min-w-0">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                
                                {/* Table badge indicator */}
                                <div className="flex flex-col items-center justify-center bg-slate-950 border border-slate-800 rounded-xl min-w-[65px] py-1 px-2 shrink-0">
                                  <span className="text-[8px] font-black uppercase text-slate-500 tracking-wide">{statusText}</span>
                                  <span className="text-sm font-black text-white leading-none mt-0.5">โต๊ะ {item.table}</span>
                                </div>

                                {/* Video Thumbnail */}
                                {ytId ? (
                                  <img
                                    src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                                    className="w-16 h-10 object-cover rounded bg-slate-800 border border-slate-700/50 shrink-0 shadow"
                                    alt="YT Thumb"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-16 h-10 rounded bg-slate-800 border border-slate-700/40 flex items-center justify-center text-xs text-slate-500 shrink-0">
                                    <Music className="w-5 h-5 text-slate-600" />
                                  </div>
                                )}

                                {/* Song Title & Time */}
                                <div className="overflow-hidden flex-1 min-w-0">
                                  <h3 className="text-xs md:text-sm font-semibold text-slate-200 line-clamp-1 group-hover:text-emerald-400 transition-colors" title={item.song}>
                                    {item.song}
                                  </h3>
                                  <span className="text-[9px] text-slate-500 flex items-center gap-1 mt-0.5 font-light">
                                    <Clock className="w-3 h-3 text-slate-600" />
                                    ขอเมื่อ {item.time} น.
                                  </span>
                                </div>
                              </div>

                              {/* Reordering buttons (Only on Pending & All display mode) */}
                              {currentTab === 'pending' && !isTableFairSort && (
                                <div className="flex flex-col gap-1 shrink-0 bg-slate-950/80 p-1 rounded-md border border-slate-800/80">
                                  <button
                                    onClick={() => moveQueueToAbsoluteTop(trueIndex)}
                                    className="text-[9px] bg-slate-900 hover:bg-emerald-500 hover:text-slate-950 text-slate-400 p-0.5 rounded cursor-pointer transition-colors font-bold"
                                    title="ย้ายขึ้นบนสุด"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5 mx-auto text-emerald-400" />
                                    <span className="text-[7px] block -mt-1 leading-none">TOP</span>
                                  </button>
                                  <button
                                    onClick={() => moveQueueUp(trueIndex)}
                                    className="text-[9px] bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-slate-400 p-0.5 rounded cursor-pointer transition-colors"
                                    title="ย้ายขึ้นทีละช่อง"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5 mx-auto" />
                                  </button>
                                  <button
                                    onClick={() => moveQueueDown(trueIndex)}
                                    className="text-[9px] bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-slate-400 p-0.5 rounded cursor-pointer transition-colors"
                                    title="ย้ายลงทีละช่อง"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5 mx-auto" />
                                  </button>
                                  <button
                                    onClick={() => moveQueueToAbsoluteBottom(trueIndex)}
                                    className="text-[9px] bg-slate-900 hover:bg-rose-500 hover:text-slate-950 text-slate-400 p-0.5 rounded cursor-pointer transition-colors font-bold"
                                    title="ย้ายลงล่างสุด"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5 mx-auto text-rose-400" />
                                    <span className="text-[7px] block -mt-1 leading-none">BOT</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons Footer */}
                            <div className="flex gap-1.5 w-full pt-2.5 border-t border-slate-800/50 items-center justify-between">
                              <div className="flex gap-1.5 flex-1">
                                {item.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        if (ytId) {
                                          initAndPlayPlayer(ytId, item.song, item.id);
                                        } else {
                                          alert("ไม่พบลิงก์วิดีโอตรง คัดลอกข้อมูลไปเปิดแทนนะครับ");
                                        }
                                      }}
                                      className="flex-1 text-center bg-rose-600 hover:bg-rose-700 text-white text-[10px] md:text-xs font-semibold py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-rose-950/20"
                                    >
                                      <Play className="w-3.5 h-3.5" /> เล่นในเว็บ
                                    </button>
                                    <button
                                      onClick={() => moveToStatus(item.id, 'completed')}
                                      className="bg-emerald-500/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 py-1.5 px-2.5 rounded-lg text-[10px] md:text-xs transition-all cursor-pointer font-semibold flex items-center gap-1 active:scale-95"
                                    >
                                      <Check className="w-3.5 h-3.5" /> เสร็จสิ้น
                                    </button>
                                  </>
                                )}

                                {item.status === 'playing' && (
                                  <>
                                    <div className="flex-1 text-[10px] md:text-xs text-rose-400 flex items-center gap-1.5 font-bold px-1 animate-pulse">
                                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> กำลังเล่น...
                                    </div>
                                    <button
                                      onClick={() => moveToStatus(item.id, 'completed')}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-4 rounded-lg text-[10px] md:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                                    >
                                      <Check className="w-3.5 h-3.5" /> จบเพลงนี้
                                    </button>
                                  </>
                                )}

                                {item.status === 'completed' && (
                                  <button
                                    onClick={() => moveToStatus(item.id, 'pending')}
                                    className="flex-1 text-center bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] md:text-xs font-semibold py-1.5 px-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> ดึงกลับไปคิวรอใหม่
                                  </button>
                                )}

                                <button
                                  onClick={() => removeQueuePermanently(item.id, item.status === 'playing')}
                                  className="bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 p-1.5 rounded-lg text-xs transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                                  title="ลบเพลงนี้ถาวร"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="flex gap-1">
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-lg text-xs transition-colors"
                                  title="เปิดลิงก์ YouTube หลัก"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                                </a>
                                <button
                                  onClick={() => copyToClipboard(item.url, item.id)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-lg text-xs transition-colors flex items-center justify-center min-w-[32px]"
                                  title="คัดลอกลิงก์"
                                >
                                  {copiedId === item.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* 🎵 ระบบจัดการเพลงแนะนำประจำร้าน (Shop Playlist Manager) */}
            <div className="glass-panel p-5 md:p-6 rounded-3xl border border-slate-800 bg-slate-900/30 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800/60 gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Music className="w-5 h-5 text-amber-400" />
                    ระบบจัดการเพลงแนะนำประจำร้าน (Shop Playlist Manager)
                  </h3>
                  <p className="text-xs text-slate-400">
                    ดีเจสามารถตั้งค่าเพลย์ลิสต์หมวดหมู่ต่างๆ เพื่อสลับเข้าเล่นคิวอัตโนมัติเมื่อคิวลูกค้าหลักว่างลง
                  </p>
                </div>
                
                {/* Active Category Display */}
                <div className="bg-slate-950 border border-slate-800/80 px-4 py-2 rounded-2xl flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[11px] text-slate-400">เพลย์ลิสต์ใช้เล่นออโต้หลัก:</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {recommendedCategories[activeCategoryId]?.name || "ไม่มีการตั้งค่า"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 1. คอลัมน์ซ้าย: จัดการและเลือกหมวดหมู่เพลงแนะนำ */}
                <div className="lg:col-span-4 space-y-5">
                  <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-2xl space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      เปิดใช้งาน / ตั้งค่าเพลย์ลิสต์
                    </h4>
                    
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {Object.keys(recommendedCategories).map((catId) => {
                        const cat = recommendedCategories[catId];
                        const songCount = cat.songs ? Object.keys(cat.songs).length : 0;
                        const isActive = activeCategoryId === catId;
                        const isEditing = selectedCategoryForEdit === catId;
                        
                        return (
                          <div 
                            key={catId}
                            className={`p-3 rounded-xl border flex items-center justify-between transition-all gap-2 ${
                              isActive 
                                ? 'bg-emerald-500/10 border-emerald-500/40' 
                                : isEditing
                                ? 'bg-slate-900 border-slate-700'
                                : 'bg-slate-950 border-slate-900 hover:border-slate-800'
                            }`}
                          >
                            <div 
                              className="flex-1 cursor-pointer min-w-0"
                              onClick={() => setSelectedCategoryForEdit(catId)}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-200 truncate block">
                                  {cat.name}
                                </span>
                                {isActive && (
                                  <span className="bg-emerald-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase scale-90 shrink-0">
                                    Active
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                🎵 {songCount} เพลง
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {/* Toggle active button */}
                              {!isActive && (
                                <button
                                  onClick={() => handleSetActiveCategory(catId)}
                                  className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/20 py-1 px-2 rounded-lg transition-all font-semibold cursor-pointer"
                                  title="ใช้สลับเล่นออโต้"
                                >
                                  เปิดใช้
                                </button>
                              )}
                              
                              {/* Delete Category */}
                              <button
                                onClick={() => handleDeleteCategory(catId)}
                                className="p-1 text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-600 rounded-lg transition-all cursor-pointer"
                                title="ลบหมวดหมู่นี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* สร้างหมวดหมู่ใหม่ */}
                    <form onSubmit={handleAddCategory} className="pt-3 border-t border-slate-800/60 space-y-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        ➕ สร้างหมวดหมู่เพลงแนะนำใหม่
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="เช่น เพลงฮิตประจำสัปดาห์, เพลงสงกรานต์..."
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          type="submit"
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0"
                        >
                          สร้าง
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* 2. คอลัมน์ขวา: จัดการรายการเพลงในหมวดหมู่ที่เลือก */}
                <div className="lg:col-span-8 space-y-5">
                  <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/60">
                      <div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          📁 จัดการหมวดหมู่: <span className="text-amber-400 font-bold">{recommendedCategories[selectedCategoryForEdit]?.name || 'กรุณาเลือกหมวดหมู่'}</span>
                        </h4>
                        <p className="text-[10px] text-slate-400">คุณสามารถเพิ่มหรือลบเพลงในเพลย์ลิสต์สลับเข้าคิวอัตโนมัติได้ด้านล่าง</p>
                      </div>
                      
                      <div className="text-[10px] bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-slate-300 font-mono self-start sm:self-center">
                        รวม {recommendedCategories[selectedCategoryForEdit]?.songs ? Object.keys(recommendedCategories[selectedCategoryForEdit].songs).length : 0} เพลง
                      </div>
                    </div>

                    {/* รายการเพลง */}
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {(() => {
                        const activeCat = recommendedCategories[selectedCategoryForEdit];
                        const songsObj = activeCat?.songs || {};
                        const songsArray = Object.values(songsObj) as any[];

                        if (songsArray.length === 0) {
                          return (
                            <div className="text-center py-8 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl">
                              <Music className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-pulse" />
                              <p className="text-xs text-slate-400 font-medium">ยังไม่มีเพลงในหมวดหมู่นี้</p>
                              <p className="text-[10px] text-slate-500 mt-1">กรอกข้อมูลเพลงเพื่อเพิ่มเพลงแนะนำได้เลยครับ</p>
                            </div>
                          );
                        }

                        return songsArray.map((song: any) => (
                          <div 
                            key={song.id} 
                            className="p-2 bg-slate-950/80 border border-slate-900 rounded-xl flex items-center justify-between gap-4 hover:border-slate-800 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img 
                                src={`https://img.youtube.com/vi/${song.videoId}/default.jpg`} 
                                alt={song.song} 
                                className="w-12 h-9 object-cover rounded-md bg-slate-900 shrink-0 border border-slate-800"
                                referrerPolicy="no-referrer"
                              />
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-slate-200 block truncate max-w-[400px]">
                                  {song.song}
                                </span>
                                <a 
                                  href={song.url} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-[9px] text-amber-500/80 hover:text-amber-400 hover:underline inline-flex items-center gap-0.5"
                                >
                                  ลิงก์ YouTube <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteSongFromCategory(selectedCategoryForEdit, song.id)}
                              className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg transition-all cursor-pointer shrink-0"
                              title="ลบเพลงออก"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ));
                      })()}
                    </div>

                    {/* ฟอร์มเพิ่มเพลง */}
                    <form onSubmit={handleAddSongToCategory} className="pt-3 border-t border-slate-800/60 space-y-3">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        ➕ เพิ่มเพลงใหม่ลงในหมวดหมู่นี้
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-5">
                          <input
                            type="text"
                            placeholder="ชื่อเพลง (เช่น รักแรก - NONT TANONT)"
                            value={newSongTitle}
                            onChange={(e) => setNewSongTitle(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div className="sm:col-span-5">
                          <input
                            type="text"
                            placeholder="ลิงก์ YouTube (เช่น https://www.youtube.com/watch?v=...)"
                            value={newSongUrl}
                            onChange={(e) => setNewSongUrl(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs p-2.5 rounded-xl transition-all active:scale-95 cursor-pointer"
                          >
                            เพิ่มเพลง
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

      </main>

      {/* ==================== DJ PASSWORD MODAL ==================== */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 transition-all duration-300 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 md:p-8 shadow-2xl relative space-y-5 transform scale-100 transition-transform">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center text-xl border border-amber-500/20 shadow-lg">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">ยืนยันรหัสผ่าน "ดีเจ"</h3>
              <p className="text-xs text-slate-400">กรุณากรอกรหัสผ่านเพื่อสลับไปหน้าบอร์ดควบคุม</p>
            </div>

            <div>
              <input
                type="password"
                placeholder="กรอกรหัสผ่าน"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') verifyDjPassword();
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-center text-white tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500/35 transition-all font-mono font-bold text-lg"
              />
              {passwordError && (
                <p className="text-[11px] text-rose-400 mt-2 text-center font-medium">
                  {passwordError}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setPasswordError("");
                  setPasswordInput("");
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs md:text-sm font-semibold py-3 rounded-xl transition-all border border-slate-700 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={verifyDjPassword}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs md:text-sm font-black py-3 rounded-xl transition-all shadow-lg shadow-amber-500/15 cursor-pointer"
              >
                เข้าสู่ระบบดีเจ
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
