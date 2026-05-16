"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Rocket, Code, Award, Globe, Briefcase, Heart, Sparkles } from "lucide-react";

interface ResourceLink {
  title: string;
  description: string;
  url: string;
  icon: React.ElementType;
  color: string;
}

const resources: ResourceLink[] = [
  {
    title: "Coding",
    description: "Learn to code with freeCodeCamp",
    url: "https://www.freecodecamp.org",
    icon: Code,
    color: "bg-[#7C3AED]",
  },
  {
    title: "Leadership",
    description: "Women Who Code community",
    url: "https://www.womenwhocode.com",
    icon: Award,
    color: "bg-[#C62168]",
  },
  {
    title: "Networking",
    description: "WomenTech Network",
    url: "https://www.womentech.net",
    icon: Globe,
    color: "bg-teal",
  },
  {
    title: "Career",
    description: "Built By Girls programs",
    url: "https://www.builtbygirls.com",
    icon: Briefcase,
    color: "bg-[#E87722]",
  },
  {
    title: "Wellbeing",
    description: "Headspace mindfulness",
    url: "https://www.headspace.com",
    icon: Heart,
    color: "bg-[#E53E3E]",
  },
  {
    title: "Inspiration",
    description: "Girls Who Code movement",
    url: "https://girlswhocode.com",
    icon: Sparkles,
    color: "bg-[#F5C040]",
  },
];

export default function TechResourcesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-card">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1 cursor-pointer">
            <ArrowLeft size={20} className="text-text-main" />
          </button>
          <h1 className="text-lg font-bold text-text-main">Tech Resources</h1>
        </div>
      </header>

      <div className="pb-8">
        {/* Hero Card */}
        <div className="mx-4 mt-4 p-6 bg-gradient-to-br from-primary to-teal rounded-2xl text-white">
          <div className="flex items-center gap-3 mb-3">
            <Rocket size={24} />
            <h2 className="text-lg font-bold">Women in Tech</h2>
          </div>
          <p className="text-sm leading-relaxed opacity-90">
            Empowering women in technology through resources, community, and learning opportunities.
          </p>
        </div>

        {/* Resource Links */}
        <div className="px-4 mt-4 space-y-3">
          {resources.map((resource) => {
            const Icon = resource.icon;
            return (
              <a
                key={resource.title}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl border border-border-light hover:bg-bg-light/50 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl ${resource.color} flex items-center justify-center shrink-0`}>
                  <Icon size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-main">{resource.title}</p>
                  <p className="text-xs text-text-light">{resource.description}</p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
