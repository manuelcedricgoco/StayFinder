import { House, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LOCATIONS } from '../../data/landingContent';

const QUICK_LINKS = [
  { label: 'Home', href: '/#home' },
  { label: 'Find a Place', href: '/#featured' },
  { label: 'About', href: '/#about' },
  { label: 'Contact', href: '/#contact' },
];

export function Footer() {
  return (
    <footer id="contact" className="scroll-mt-16 bg-slate-900 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 text-lg font-bold text-white">
            <House size={19} aria-hidden="true" />
            StayFinder
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            Helping students, workers, and families find boarding houses, apartments, and rooms
            across Occidental Mindoro.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-white">Quick Links</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {QUICK_LINKS.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="hover:text-white">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-white">Popular Locations</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {LOCATIONS.slice(0, 5).map((location) => (
              <li key={location.name}>
                <a href="/#locations" className="hover:text-white">
                  {location.name}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-white">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Mail size={15} aria-hidden="true" />
              stayfinder@gmail.com
            </li>
            <li className="flex items-center gap-2">
              <MapPin size={15} aria-hidden="true" />
              Occidental Mindoro, Philippines
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-800 px-4 py-5 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Occidental Mindoro StayFinder ·{' '}
        <Link to="/health" className="underline hover:text-white">
          System status
        </Link>
        {' · '}
        <a
          href="https://www.flaticon.com/free-icon/favicon_7915382"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-white"
        >
          Favicon icon by Lizel Arina on Flaticon
        </a>
      </div>
    </footer>
  );
}
