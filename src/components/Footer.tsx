
import React from "react";
import { Link } from "react-router-dom";

export interface FooterContent {
  footerDesc: string;
  travelersHeading: string;
  howToBook: string;
  paymentMethods: string;
  travelTips: string;
  hostsHeading: string;
  startHosting: string;
  hostResources: string;
  pricingTips: string;
  supportHeading: string;
  helpCenter: string;
  safetyInfo: string;
  contactUs: string;
  rights: string;
  privacy: string;
  terms: string;
}

interface FooterProps {
  content: FooterContent;
  year?: number;
}

const Footer: React.FC<FooterProps> = ({
  content,
  year = new Date().getFullYear(),
}) => {
  const footerSections = [
    {
      id: "travelers",
      heading: content.travelersHeading,
      links: [
        { label: content.howToBook, href: "/how-to-book" },
        { label: content.paymentMethods, href: "/payment-methods" },
        { label: content.travelTips, href: "/travel-tips" },
      ],
    },
    {
      id: "hosts",
      heading: content.hostsHeading,
      links: [
        { label: content.startHosting, href: "/start-hosting" },
        { label: content.hostResources, href: "/host-resources" },
        { label: content.pricingTips, href: "/pricing-tips" },
      ],
    },
    {
      id: "support",
      heading: content.supportHeading,
      links: [
        { label: content.helpCenter, href: "/help-center" },
        { label: content.safetyInfo, href: "/safety-info" },
        { label: content.contactUs, href: "/contact" },
      ],
    },
  ];

  return (
    <footer className="bg-[#111] px-4 pb-24 pt-10 sm:px-6 sm:pt-12 md:pb-7">
      <div className="mx-auto max-w-screen-xl">
        <div className="mb-8 grid grid-cols-2 gap-8 border-b border-[#222] pb-8 lg:grid-cols-4">

          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link
              to="/"
              className="font-arabic text-[26px] font-medium tracking-wide no-underline text-white"
            >
              مر
              <span className="font-bold text-[#e8c547]">حبا</span>
            </Link>

            <p className="mt-3 text-sm leading-[1.7] text-[#777]">
              {content.footerDesc}
            </p>
          </div>

          {/* Footer sections */}
          {footerSections.map((section) => (
            <div key={section.id}>
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#777]">
                {section.heading}
              </div>

              {section.links.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="mb-3 block text-[13px] text-[#aaa] no-underline transition-colors hover:text-yellow-400"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom footer */}
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-[#666]">
            &copy; {year} Marhaba. {content.rights}
          </p>

          <div className="flex gap-5">
            <Link
              to="/privacy"
              className="text-xs text-[#aaa] no-underline transition-colors hover:text-yellow-400"
            >
              {content.privacy}
            </Link>

            <Link
              to="/terms"
              className="text-xs text-[#aaa] no-underline transition-colors hover:text-yellow-400"
            >
              {content.terms}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
