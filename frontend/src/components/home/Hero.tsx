import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

const HERO_VIDEO_URL =
  'https://videos.pexels.com/video-files/19228172/19228172-uhd_2560_1440_30fps.mp4';

export function Hero() {
  return (
    <section id="home" className="relative isolate flex min-h-[60vh] items-center overflow-hidden bg-slate-950 text-white">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-60"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      >
        <source src={HERO_VIDEO_URL} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-16 text-center sm:py-20 lg:text-left">
        <p className="inline-flex items-center justify-center rounded-full bg-white/10 px-4 py-1 text-sm font-medium text-emerald-100 backdrop-blur-sm sm:justify-start">
          <GraduationCap className="mr-2 h-4 w-4" aria-hidden="true" />
          Student-friendly rentals across the province
        </p>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
          Find Your Perfect Place in<br className="hidden lg:block" /> Occidental Mindoro
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-emerald-50/90 lg:mx-0">
          Discover boarding houses, apartments, rooms, and affordable rental spaces, whether you are
          starting college, starting a new job, or moving to a new town.
        </p>
        <div className="mt-10 flex justify-center lg:justify-start">
          <Link
            to="/properties"
            className="inline-flex transform items-center rounded-lg bg-emerald-700 px-8 py-4 font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/30"
          >
            Browse places
          </Link>
        </div>
      </div>
    </section>
  );
}
