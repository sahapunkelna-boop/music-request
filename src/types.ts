export interface SongRequest {
  id: string;
  table: string | number;
  song: string;
  url: string;
  time: string;
  status: 'pending' | 'playing' | 'completed';
  order: number;
}

export interface YouTubeSearchResult {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: string;
}
