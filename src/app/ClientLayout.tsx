"use client";

import Loader from "./Loader";
import Header from "./Header";
import Footer from "./Footer";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { useMemo } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";
import ChatWidget from "./components/ChatWidget";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { ToastProvider } from "@/components/Toast";
import { AudioProvider } from "@/contexts/AudioContext";
import { WEBSOCKET_CONFIG } from "@/lib/websocketConfig";
import LightRays from "@/Backgrounds/LightRays";
import Prism from "@/Backgrounds/Prism";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const endpoint = "https://api.mainnet-beta.solana.com";
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);
  return (
    <AudioProvider>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <ToastProvider>
              <WebSocketProvider useDiscordClient={WEBSOCKET_CONFIG.USE_DISCORD_CLIENT}>
                <Loader>
                  {/* LightRays Background */}
                  <div style={{ 
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100vh', 
                    zIndex: -1,
                    pointerEvents: 'none'
                  }}>
                    <Prism
                      animationType="rotate"
                      timeScale={0.5}
                      height={3.5}
                      baseWidth={5.5}
                      scale={3.6}
                      hueShift={0}
                      colorFrequency={1}
                      noise={0.5}
                      glow={1}
                    />
                  </div>
                  
                  <div className="flex flex-col min-h-screen w-full max-w-full relative z-10">
                    <Header />
                    <main className="flex-1 flex flex-col w-full px-4 sm:px-6">
                      {children}
                    </main>
                    <Footer />
                  </div>
                  {/* <ChatWidget /> */}
                </Loader>
              </WebSocketProvider>
            </ToastProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </AudioProvider>
  );
}
