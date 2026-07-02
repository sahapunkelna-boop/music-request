import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = window.location.origin + window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex items-center justify-center p-4 relative overflow-hidden">
          {/* Decorative backgrounds */}
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-rose-500/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-violet-500/10 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="max-w-md w-full bg-slate-900/80 border border-slate-800/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl text-center space-y-6 relative z-10">
            <div className="mx-auto w-16 h-16 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center border border-rose-500/20 shadow-lg">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-100">
                เกิดข้อผิดพลาดในการทำงาน
              </h1>
              <p className="text-xs md:text-sm text-slate-400 font-light leading-relaxed">
                ขออภัยด้วยครับ แอปพลิเคชันพบข้อผิดพลาดบางประการในการเรนเดอร์หน้าเว็บ
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-left overflow-x-auto max-h-32 text-[10px] font-mono text-rose-300">
                <p className="font-bold mb-1">Error Message:</p>
                <p>{this.state.error.toString()}</p>
                {this.state.error.stack && (
                  <p className="opacity-50 mt-1 whitespace-pre">{this.state.error.stack}</p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs md:text-sm font-semibold py-3 rounded-xl transition-all border border-slate-700 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                โหลดหน้าใหม่
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 text-xs md:text-sm font-black py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/15 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Home className="w-4 h-4" />
                กลับหน้าหลัก
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
