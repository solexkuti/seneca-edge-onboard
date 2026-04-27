import { type ReactNode } from "react";

export default function PhoneFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative mx-auto aspect-[9/18.5] w-[260px] animate-float-slow ${className}`}
      style={{ filter: "drop-shadow(0 24px 40px rgba(30, 41, 59, 0.12))" }}
    >
      {/* Outer body */}
      <div className="absolute inset-0 rounded-[44px] bg-gradient-to-b from-white to-[#EEF0F8] p-[6px] ring-1 ring-black/5 animate-breathe">
        {/* Inner screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[38px] bg-[#0F172A]">
          {/* Notch */}
          <div className="absolute left-1/2 top-2 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-black/80" />
          {children}
        </div>
      </div>
    </div>
  );
}
