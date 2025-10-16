"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SolanaStaking from "./components/SolanaStaking";
import CardMemoryGame from "./components/CardMemoryGame";
import { useLisaSounds } from "@/lib/lisaSounds";
import { animations, createHoverAnimation, createTapAnimation } from "@/lib/animations";


export default function Home() {
  const [showStakingModal, setShowStakingModal] = useState(false);
  const [showCardGame, setShowCardGame] = useState(false);
  const { playButtonClick, playLinkClick, playHoverSound } = useLisaSounds();
  
  const [tokenData, setTokenData] = useState({
    price: '$0.00006489',
    marketCap: '$64K',
    totalSupply: '985.14M Jaime',
    holders: '290'
  });
  const [loading, setLoading] = useState(false);

  const fetchTokenData = async () => {
    setLoading(true);
    try {
      // Jupiter Lite token details (supply, holders, usdPrice, mcap)
      const liteResp = await fetch('https://lite-api.jup.ag/tokens/v2/search?query=5XChiQd7WHbk9SzsxSaCRstXE5WNpFB1VigAyCGCpump');
      const liteJson = await liteResp.json();
      if (Array.isArray(liteJson) && liteJson.length > 0) {
        const t = liteJson[0];
        const usdPrice = typeof t.usdPrice === 'number' ? t.usdPrice : undefined;
        const mcap = typeof t.mcap === 'number' ? t.mcap : undefined;
        const holders = typeof t.holderCount === 'number' ? t.holderCount : undefined;
        const supply = typeof t.totalSupply === 'number' ? t.totalSupply : undefined;

        setTokenData(prev => ({
          ...prev,
          price: usdPrice ? `$${usdPrice.toFixed(8)}` : prev.price,
          marketCap: mcap ? `$${Math.round(mcap).toLocaleString()}` : prev.marketCap,
          totalSupply: supply ? `${(supply/1_000_000).toFixed(2)}M Jaime` : prev.totalSupply,
          holders: holders ? `${holders}` : prev.holders,
        }));
      }
    } catch (error) {
      console.log('Error fetching token data:', error);
      // Keep default values if API fails
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchTokenData();
    // Refresh details every 1 hour
    const hourly = setInterval(fetchTokenData, 60 * 60 * 1000);
    return () => { clearInterval(hourly); };
  }, []);

  // Dummy social media posts
  const posts = [
    {
      id: 1,
      username: "JaimeCapital",
      handle: "@JaimeCapital",
      avatar: "💰",
      time: "2h",
      content: "Jaime.Capital is revolutionizing wealth building! The coin that makes people richer through strategic blockchain technology. #JaimeCapital #Wealth #Rich",
      likes: 142,
      retweets: 38,
      replies: 17
    },
    {
      id: 2,
      username: "RichInvestor",
      handle: "@RichInvestor",
      avatar: "💎",
      time: "4h",
      content: "Just discovered Jaime.Capital and I'm all in! Built by the rich for the rich - this is exactly what wealth building needs. 🚀💰",
      likes: 189,
      retweets: 43,
      replies: 22
    },
    {
      id: 3,
      username: "WealthBuilder",
      handle: "@WealthBuilder",
      avatar: "🏆",
      time: "6h",
      content: "Finally, a token that understands wealth! Jaime.Capital's innovative approach shows they're serious about making people richer.",
      likes: 256,
      retweets: 65,
      replies: 38
    },
    {
      id: 4,
      username: "MoneyMaker",
      handle: "@MoneyMaker",
      avatar: "💵",
      time: "8h",
      content: "In a world of financial uncertainty, Jaime.Capital stands for wealth creation. Built by the rich for the rich - I love it! 😂💰",
      likes: 303,
      retweets: 87,
      replies: 44
    },
    {
      id: 5,
      username: "JaimeCommunity",
      handle: "@JaimeCommunity",
      avatar: "👑",
      time: "12h",
      content: "Join our community and be part of the Jaime.Capital wealth revolution! We're building the future of financial prosperity, one investor at a time. #Community #JaimeCapital",
      likes: 178,
      retweets: 51,
      replies: 29
    }
  ];
  

  return (
        <motion.div 
          className="flex flex-col flex-1 py-2 sm:py-4 home-container" 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 50 }}
        >
          {/* Hero Section */}
          <motion.section 
            className="flex flex-col items-center justify-center text-center py-2 sm:py-4 md:py-6 lg:py-8 xl:py-12 px-2 sm:px-4 md:px-6 lg:px-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            {/* $JAIME.CAPITAL Title */}
            <motion.h1 
              className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-bold mb-3 sm:mb-4 md:mb-6 lg:mb-8 text-[#0000ff] tracking-tight leading-tight"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6, type: "spring", stiffness: 200 }}
            >
              $JAIME.CAPITAL
            </motion.h1>

            {/* Jaime Logo */}
            <motion.div 
              className="mb-4 sm:mb-6 md:mb-8 lg:mb-10 xl:mb-12"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8, type: "spring", stiffness: 150 }}
              whileHover={{ 
                scale: 1.05,
                transition: { duration: 0.3 }
              }}
            >
              <img 
                src="/jaime.jpg" 
                alt="Jaime.Capital Logo" 
                className="w-20 h-20 xs:w-24 xs:h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-40 lg:h-40 xl:w-48 xl:h-48 2xl:w-56 2xl:h-56 rounded-full object-cover border-2 sm:border-3 md:border-4 border-[#0000ff] shadow-lg sm:shadow-xl md:shadow-2xl"
              />
            </motion.div>

            {/* Tokenomics Info */}
            <motion.div 
              className="w-full max-w-xs xs:max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 xs:gap-3 sm:gap-4 md:gap-5 lg:gap-6 mb-4 sm:mb-6 md:mb-8">
                <motion.div 
                  className="bg-white/90 backdrop-blur-sm border border-[#808080] sm:border-2 rounded-md sm:rounded-lg p-2 xs:p-3 sm:p-4 text-center"
                  whileHover={{ scale: 1.02, y: -1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-sm xs:text-base sm:text-lg md:text-xl font-bold text-[#0000ff] mb-1 flex items-center justify-center gap-2">
                    {loading ? (
                      <span className="animate-pulse">Loading...</span>
                    ) : (
                      <>
                        <a
                          href="https://phantom.com/tokens/solana/5XChiQd7WHbk9SzsxSaCRstXE5WNpFB1VigAyCGCpump?timeFrame=YTD"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {tokenData.price}
                        </a>
                        <motion.button
                          onClick={() => {
                            fetchTokenData();
                            playLinkClick();
                          }}
                          className="text-xs text-gray-500 hover:text-[#0000ff] transition-colors"
                          title="Refresh price"
                          whileHover={{ rotate: 180 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{ duration: 0.3 }}
                        >
                          🔄
                        </motion.button>
                      </>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Current Price</div>
                </motion.div>
                
                <motion.div 
                  className="bg-white/90 backdrop-blur-sm border border-[#808080] sm:border-2 rounded-md sm:rounded-lg p-2 xs:p-3 sm:p-4 text-center"
                  whileHover={{ scale: 1.02, y: -1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-sm xs:text-base sm:text-lg md:text-xl font-bold text-[#0000ff] mb-1">
                    {loading ? (
                      <span className="animate-pulse">Loading...</span>
                    ) : (
                      tokenData.marketCap
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Market Cap</div>
                </motion.div>
                
                <motion.div 
                  className="bg-white/90 backdrop-blur-sm border border-[#808080] sm:border-2 rounded-md sm:rounded-lg p-2 xs:p-3 sm:p-4 text-center"
                  whileHover={{ scale: 1.02, y: -1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-sm xs:text-base sm:text-lg md:text-xl font-bold text-[#0000ff] mb-1">
                    {loading ? (
                      <span className="animate-pulse">Loading...</span>
                    ) : (
                      tokenData.totalSupply
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Total Supply</div>
                </motion.div>
                
                <motion.div 
                  className="bg-white/90 backdrop-blur-sm border border-[#808080] sm:border-2 rounded-md sm:rounded-lg p-2 xs:p-3 sm:p-4 text-center"
                  whileHover={{ scale: 1.02, y: -1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-sm xs:text-base sm:text-lg md:text-xl font-bold text-[#0000ff] mb-1">
                    {loading ? (
                      <span className="animate-pulse">Loading...</span>
                    ) : (
                      tokenData.holders
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Holders</div>
                </motion.div>
              </div>

              {/* Description */}
              <motion.div 
                className="max-w-xs xs:max-w-sm sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-2 sm:px-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0, duration: 0.6 }}
              >
                <h2 className="text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3 md:mb-4 text-[#0000ff] leading-tight">
                  The Coin That Makes People Richer
                </h2>
                <p className="text-xs xs:text-sm sm:text-base md:text-lg lg:text-xl text-gray-300 leading-relaxed mb-4 sm:mb-6">
                  Built by the rich for the rich – Jaime.Capital represents the ultimate wealth-building cryptocurrency. 
                  Our innovative blockchain technology is designed for one purpose: making people richer. 
                  Strategic investments, smart contracts, and wealth creation opportunities await.
                </p>
              </motion.div>
            </motion.div>
          </motion.section>

      {/* Card Memory Game Modal */}
      <CardMemoryGame 
        isOpen={showCardGame} 
        onClose={() => setShowCardGame(false)} 
      />
    </motion.div>
  );
}

