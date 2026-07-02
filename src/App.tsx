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

  // 3. Handle Auto-Playing transition of songs when nothing is playing (Only for active DJ screen)
  useEffect(() => {
    if (currentPage === 'dj' && songQueue.length > 0) {
      const hasPlayingSong = songQueue.some(item => item.status === 'playing');
      const firstPendingSong = songQueue.find(item => item.status === 'pending');
      
      // If there is no playing song and there is a pending song in the queue
      if (!hasPlayingSong && firstPendingSong) {
        const ytId = extractYouTubeId(firstPendingSong.url);
        if (ytId) {
          // Play automatically for the DJ
          initAndPlayPlayer(ytId, firstPendingSong.song, firstPendingSong.id);
        }
      }
    }
  }, [songQueue, currentPage]);

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

  // Triggered when a song ends naturally
  const handleSongEnded = (queueId: string) => {
    moveToStatus(queueId, 'completed');
  };

  // Main playback launcher (sets firebase states & starts Iframe SDK instance)
  const initAndPlayPlayer = (videoId: string, songTitle: string, queueId: string) => {
    setHasPlayerError(false);
    setPlayingVideoId(videoId);
    setPlayingSongTitle(songTitle);
    setPlayingQueueId(queueId);

    // Update state to 'playing' in Firebase, set all other 'playing' songs to 'completed'
    const updates: Record<string, any> = {};
    updates[`/songs/${queueId}/status`] = 'playing';
    
    songQueue.forEach(item => {
      if (item.status === 'playing' && item.id !== queueId) {
        updates[`/songs/${item.id}/status`] = 'completed';
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
                    // 0 = YT.PlayerState.ENDED
                    if (event.data === 0) {
                      handleSongEnded(queueId);
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
    playerRef.current = null;
  };

  // Update Firebase status helper
  const moveToStatus = (id: string, newStatus: 'pending' | 'playing' | 'completed') => {
    const updates: Record<string, any> = {};
    updates[`/songs/${id}/status`] = newStatus;

    if (newStatus === 'playing') {
      songQueue.forEach(item => {
        if (item.status === 'playing' && item.id !== id) {
          updates[`/songs/${item.id}/status`] = 'completed';
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
  const filteredAdminSongs = songQueue.filter(item => {
    const matchesTab = item.status === currentTab;
    const matchesTable = adminTableFilter === 'all' || String(item.table) === adminTableFilter;
    return matchesTab && matchesTable;
  });

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
          <div className="space-y-6">
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
                            if (playingQueueId) moveToStatus(playingQueueId, 'completed');
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
              {/* RIGHT COLUMN: QUEUE TABS & LISTS */}
              <div className="lg:col-span-5 space-y-4">
                <div className="glass-panel border border-slate-800 p-4 rounded-3xl shadow-xl space-y-4">
                  
                  {/* DJ Header controls */}
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      แผงจัดการคิวเพลงของดีเจ
                    </span>
                    <button
                      onClick={clearAllQueue}
                      className="text-[10px] bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/20 py-1.5 px-3 rounded-lg transition-all cursor-pointer active:scale-95 font-medium"
                    >
                      ล้างข้อมูลคิวทั้งหมด
                    </button>
                  </div>

                  {/* Filter by table dropdown */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5 font-medium flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      เลือกกรองดูเพลงแยกตามโต๊ะ:
                    </label>
                    <select
                      value={adminTableFilter}
                      onChange={(e) => setAdminTableFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                    >
                      <option value="all">แสดงคำขอจากทุกโต๊ะ (ทั้งหมด)</option>
                      {tables.map(num => (
                        <option key={num} value={num}>แสดงคิวเฉพาะ "โต๊ะที่ {num}"</option>
                      ))}
                    </select>
                  </div>

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
                      <p className="text-slate-600 text-[10px] mt-1 font-light">ทดลองเข้าโหมดผู้ใช้เพื่อกดส่งเพลงเข้ามาดูคิว</p>
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

                              {/* Drag Reordering buttons (Only on Pending & All display mode) */}
                              {currentTab === 'pending' && adminTableFilter === 'all' && (
                                <div className="flex flex-col gap-1 shrink-0 bg-slate-950/80 p-1 rounded-md border border-slate-800/80">
                                  <button
                                    onClick={() => moveQueueUp(trueIndex)}
                                    className="text-[9px] bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-slate-400 p-1 rounded cursor-pointer transition-colors"
                                    title="ย้ายขึ้น"
                                  >
                                    <ChevronUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => moveQueueDown(trueIndex)}
                                    className="text-[9px] bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-slate-400 p-1 rounded cursor-pointer transition-colors"
                                    title="ย้ายลง"
                                  >
                                    <ChevronDown className="w-3 h-3" />
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
                                      <span className="w-2 h-2 rounded-full bg-rose-500"></span> กำลังเล่น...
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
