import { QRCodeSVG } from "qrcode.react";

interface QRCodeDisplayProps {
  pin: string;
  size?: number;
}

export default function QRCodeDisplay({ pin, size = 200 }: QRCodeDisplayProps) {
  const joinUrl = `https://quiz-player.rushelwedsivani.com/join/${pin}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-white p-4 rounded-2xl shadow-xl shadow-black/40">
        <QRCodeSVG
          value={joinUrl}
          size={size}
          bgColor="#ffffff"
          fgColor="#0D0F14"
          level="M"
          includeMargin={false}
        />
      </div>
      <p className="text-text-secondary text-xs text-center">
        quiz-player.rushelwedsivani.com/join/<span className="text-accent font-mono font-bold">{pin}</span>
      </p>
    </div>
  );
}
