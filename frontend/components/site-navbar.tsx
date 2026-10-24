"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { config } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faMoon, faSearch } from "@fortawesome/free-solid-svg-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import "@fortawesome/fontawesome-svg-core/styles.css";

// Ship FontAwesome's CSS with the bundle so icons don't flash on first paint.
config.autoAddCss = false;

const LOGO =
  "https://openforestobservatory.org/media/logo_hu4b7ec54b4a947a3d4a284f074f9e27b9_10593_0x70_resize_lanczos_3.png";

const MENU = [
  { href: "/data", label: "Data" },
  { href: "/data/sql", label: "SQL console" },
  { href: "/data/upload", label: "Contribute" },
  { href: "https://openforestobservatory.org/tools/", label: "Tools" },
  { href: "https://openforestobservatory.org/get-involved/", label: "Get Involved" },
  { href: "https://openforestobservatory.org/about/", label: "About" },
];

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Automatic" },
];

export const FOCUS_SEARCH_EVENT = "ofo:focus-search";

function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("shrink-0 py-[5px]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO} alt="Open Forest Observatory" className="h-10 w-auto lg:h-[60px]" />
    </Link>
  );
}

// Matches the look of the navbar on openforestobservatory.org: #333 bar (#282a36 in
// dark), Noto Sans links, search and theme icons on the right.
export function SiteNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const onSearch = () => {
    if (pathname === "/data/catalog") window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
    else router.push("/data/catalog?search=1");
  };

  const iconButton =
    "flex items-center text-[18px] text-white/85 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-[#7ec2c5] rounded-sm";

  return (
    <nav className="relative z-[1030] h-[var(--nav-h)] bg-[#333] px-4 text-[16.17px] leading-tight shadow-[0_2px_4px_rgba(0,0,0,0.11)] dark:bg-[#282a36] dark:shadow-[0_2px_4px_rgba(255,255,255,0.11)]">
      <div className="mx-auto flex h-full w-full items-center xl:max-w-[1290px] xl:px-[15px]">
        <Brand className="mr-4 hidden lg:block" />

        <button
          type="button"
          className="relative z-10 py-1 text-[1.125rem] text-white/90 lg:hidden dark:text-white"
          aria-controls="site-menu"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
        <div className="absolute inset-x-0 flex justify-center lg:hidden">
          <Brand />
        </div>

        <div
          id="site-menu"
          className={cn(
            "absolute inset-x-0 top-[var(--nav-h)] bg-[#333] dark:bg-[#282a36] lg:static lg:flex lg:flex-1 lg:justify-end lg:bg-transparent lg:dark:bg-transparent",
            !menuOpen && "hidden",
          )}
        >
          <ul className="flex flex-col lg:flex-row">
            {MENU.map((item) => (
              <li key={item.href} className="px-[15px] py-2.5 lg:p-0">
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-[15px] py-[5px] text-white/90 lg:p-2 dark:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 ml-auto flex items-center gap-4 md:pl-2">
          <button type="button" aria-label="Search" className={iconButton} onClick={onSearch}>
            <FontAwesomeIcon icon={faSearch} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Display preferences" className={iconButton}>
              <FontAwesomeIcon icon={faMoon} />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="z-[1032] min-w-40 rounded border-black/15 bg-[#333] p-0 py-2 text-white/90 ring-0 dark:bg-[#282a36] dark:text-white"
            >
              {THEMES.map((t) => (
                <DropdownMenuItem
                  key={t.value}
                  onSelect={() => setTheme(t.value)}
                  className={cn(
                    "rounded-none px-6 py-1 text-[16.17px] text-inherit focus:bg-white/10 focus:text-inherit",
                    theme === t.value && "font-bold text-[#7ec2c5] focus:text-[#7ec2c5] dark:text-white/80",
                  )}
                >
                  {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
