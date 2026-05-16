import Image from "next/image";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 30% 20%, #0d2a45 0%, #071829 50%, #040f1d 100%)" }}
    >
      {/* Layered ambient orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[55vw] h-[55vw] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(42,171,171,0.12) 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] right-[-8%] w-[50vw] h-[50vw] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(93,204,198,0.08) 0%, transparent 70%)" }} />
      <div className="absolute top-[40%] right-[10%] w-[30vw] h-[30vw] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(198,33,104,0.06) 0%, transparent 70%)", animation: "pulse 6s ease-in-out infinite" }} />

      {/* Mesh grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
      }} />

      <div className="relative flex flex-col items-center gap-10">
        {/* Logo lockup */}
        <div className="relative flex items-center justify-center">
          {/* Outer ping ring */}
          <div className="absolute w-24 h-24 rounded-full border border-[rgba(42,171,171,0.3)]"
            style={{ animation: "ringPulse 2.4s ease-out infinite" }} />
          {/* Mid ring */}
          <div className="absolute w-20 h-20 rounded-full border border-[rgba(42,171,171,0.2)]"
            style={{ animation: "ringPulse 2.4s ease-out infinite", animationDelay: "0.4s" }} />
          {/* Logo circle */}
          <div className="relative w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(42,171,171,0.35)]"
            style={{ background: "linear-gradient(135deg, #2AABAB 0%, #1d8a8a 50%, #156060 100%)" }}
          >
            <div className="w-[52px] h-[52px] rounded-[14px] bg-white/95 shadow-[0_6px_20px_rgba(0,0,0,0.2)] flex items-center justify-center">
              <Image
                src="/itga_logo.png"
                alt="ITGA"
                width={44}
                height={26}
                className="w-[44px] h-auto object-contain"
                priority
              />
            </div>
          </div>
        </div>

        {/* Brand text */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[28px] font-black text-white tracking-tight leading-none">ITGA</span>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-[rgba(42,171,171,0.3)] bg-[rgba(42,171,171,0.08)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2AABAB]" style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
              <span className="text-[10px] text-[#5DCCC6] font-semibold tracking-widest uppercase">Live</span>
            </div>
          </div>
          <p className="text-[12px] text-[rgba(255,255,255,0.3)] tracking-[0.25em] uppercase font-medium">
            IT Girls Academy
          </p>
        </div>

        {/* Progress track */}
        <div className="flex flex-col items-center gap-3 w-[200px]">
          <div className="w-full h-[2px] rounded-full overflow-hidden bg-[rgba(255,255,255,0.07)]">
            <div className="h-full rounded-full"
              style={{
                background: "linear-gradient(90deg, transparent, #2AABAB, #5DCCC6, #2AABAB, transparent)",
                backgroundSize: "300% 100%",
                animation: "shimmer 1.6s ease-in-out infinite",
              }}
            />
          </div>
          {/* Dots */}
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: i === 2 ? 8 : 5,
                  height: i === 2 ? 8 : 5,
                  background: `rgba(42,171,171,${0.3 + i * 0.1})`,
                  animation: `dotDance 1.4s ease-in-out infinite`,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ringPulse {
          0%   { transform: scale(0.92); opacity: 0.8; }
          50%  { transform: scale(1.08); opacity: 0.2; }
          100% { transform: scale(0.92); opacity: 0.8; }
        }
        @keyframes shimmer {
          0%   { background-position: 150% 50%; }
          100% { background-position: -150% 50%; }
        }
        @keyframes dotDance {
          0%, 60%, 100% { transform: scaleY(1); opacity: 0.4; }
          30%            { transform: scaleY(1.8); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
