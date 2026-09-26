"use client";

import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, createContext, useContext } from "react";
import { Menu, X } from "lucide-react";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

/**
 * The sidebar, rendered ONCE.
 *
 * This used to render `children` twice — a DesktopSidebar hidden below md and a
 * MobileSidebar hidden at md and up — so every nav button existed twice in the
 * DOM with only CSS deciding which one you could see. Anything walking the tree
 * (assistive tech, test tooling, our own find/read_page helpers) got two of
 * everything, and clicking the inert copy silently did nothing.
 *
 * Now there is one element. Below md it is a full-screen drawer that slides in;
 * at md and up the same element becomes the static rail. The hamburger is the
 * only thing that is mobile-only, and it contains no navigation of its own.
 */
export const SidebarBody = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <>
      {/* Mobile trigger. Not a duplicate of the nav — just the button that opens it. */}
      <div className="flex h-10 w-full flex-row items-center justify-end bg-sidebar px-4 py-4 md:hidden">
        <Menu
          aria-label="Open navigation"
          className="cursor-pointer text-neutral-800 dark:text-neutral-200"
          onClick={() => setOpen(!open)}
        />
      </div>

      <div
        className={cn(
          // Below md: an overlay drawer.
          "fixed inset-0 z-[100] flex h-full w-full flex-col overflow-y-auto bg-white p-6 transition-transform duration-300 ease-in-out sm:p-10 dark:bg-neutral-900",
          open ? "translate-x-0" : "-translate-x-full",
          // md and up: the static rail, same element.
          "md:static md:z-auto md:translate-x-0 md:overflow-hidden md:bg-neutral-100 md:px-4 md:py-4 md:dark:bg-neutral-800",
          animate && "md:transition-[width] md:duration-300 md:ease-in-out",
          open ? "md:w-[300px]" : "md:w-[60px]",
          className
        )}
        // Hover-to-expand is a pointer affordance, so it only applies to the rail.
        // Touch devices do not fire these, and below md the drawer is driven by
        // the hamburger instead.
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        {...props}
      >
        <div
          className="absolute top-6 right-6 z-50 cursor-pointer text-neutral-800 sm:top-10 sm:right-10 md:hidden dark:text-neutral-200"
          onClick={() => setOpen(false)}
        >
          <X aria-label="Close navigation" />
        </div>
        {children}
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
  props?: LinkProps;
}) => {
  const { open, animate } = useSidebar();
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center justify-start gap-2 group/sidebar py-2",
        className
      )}
      {...props}
    >
      {link.icon}
      <span
        className={cn(
          "text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 whitespace-pre !p-0 !m-0 overflow-hidden inline-block",
          animate && "transition-all duration-200",
          open ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
        )}
      >
        {link.label}
      </span>
    </Link>
  );
};
