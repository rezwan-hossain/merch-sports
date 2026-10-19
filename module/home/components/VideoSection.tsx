// module/home/components/VideoSection.tsx
//
// Homepage "Watch the race" section: a grid of YouTube videos.
//
// How it works (for each video):
//   1. At first we show only the thumbnail image + a play button (cheap).
//   2. When someone clicks play, we swap the image for the real YouTube player.
// This keeps the homepage fast: YouTube's player is only loaded when needed.
//
// To add a video: add an item to VIDEOS below. The `id` is the part after
// "watch?v=" in the YouTube link.
"use client";

import { useState } from "react";
import { Play } from "lucide-react";

const VIDEOS = [
  { id: "sQAtTUA9LPQ", label: "Promo", title: "Promo — অদম্য বাংলাদেশ হাফ ম্যারাথন ২০২৬" },
  { id: "ct-wDgEbwp4", label: "Faces of the race", title: "Faces of অদম্য বাংলাদেশ হাফ ম্যারাথন ২০২৬" },
  { id: "T0xSju8wIt8", label: "Final event film", title: "Official final event video — অদম্য বাংলাদেশ হাফ ম্যারাথন ২০২৬" },
];

type Video = (typeof VIDEOS)[number];

function VideoCard({ video }: { video: Video }) {
  // false = show the thumbnail, true = show the YouTube player
  const [isPlaying, setIsPlaying] = useState(false);

  const thumbnailUrl = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
  // youtube-nocookie.com = YouTube's privacy-friendly player
  const playerUrl = `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`;

  return (
    <div>
      {/* 16:9 box with rounded corners */}
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-lg">
        {isPlaying ? (
          <iframe
            src={playerUrl}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            aria-label={`Play video: ${video.title}`}
            className="group absolute inset-0 h-full w-full cursor-pointer"
          >
            {/* Thumbnail */}
            {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail from YouTube's own CDN */}
            <img
              src={thumbnailUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {/* Dark fade at the bottom so the label is readable */}
            <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            {/* Play button in the middle */}
            <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-neon-lime ring-8 ring-white/25 transition-transform duration-300 group-hover:scale-110">
              <Play className="ml-0.5 h-6 w-6 fill-gray-900 text-gray-900" />
            </span>

            {/* Small label at the bottom left */}
            <span className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-lime" />
              {video.label}
            </span>
          </button>
        )}
      </div>

      {/* Title under the video */}
      <p className="mt-3 text-sm font-semibold text-gray-900">{video.title}</p>
    </div>
  );
}

export default function VideoSection() {
  return (
    <section id="videos" className="px-4 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-7xl">
        {/* Heading */}
        <h2 className="mb-10 text-6xl uppercase leading-[0.9] tracking-tight text-[#0d2b22] sm:text-7xl md:mb-14 md:text-8xl">
          Watch the
          <br />
          <span className="text-neon-lime">race</span>
        </h2>

        {/* Videos: 1 per row on phones, 2 on tablets, 3 on desktop */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {VIDEOS.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      </div>
    </section>
  );
}
