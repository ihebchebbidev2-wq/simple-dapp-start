import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Shield, Users, ArrowRight, Clock, Globe, Award, TrendingUp, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import warehouseImage from "@/assets/images/warehouse-banner.jpg";
import fleetImage from "@/assets/images/about-fleet.jpg";

export default function AboutPage() {
  const { t } = useLanguage();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const milestones = [
    { icon: "01", titleKey: "about.milestone.foundation", descKey: "about.milestone.foundation.desc" },
    { icon: "02", titleKey: "about.milestone.distribution", descKey: "about.milestone.distribution.desc" },
    { icon: "03", titleKey: "about.milestone.assortment", descKey: "about.milestone.assortment.desc" },
    { icon: "04", titleKey: "about.milestone.coverage", descKey: "about.milestone.coverage.desc" },
  ];

  const team = [
    { nameKey: "about.team.ceo.name", roleKey: "about.team.ceo.role", descKey: "about.team.ceo.desc" },
    { nameKey: "about.team.ops.name", roleKey: "about.team.ops.role", descKey: "about.team.ops.desc" },
  ];

  return (
    <div className="bg-background min-h-screen">
      {/* Cinematic Hero */}
      <section className="relative min-h-[500px] sm:min-h-[600px] flex items-center overflow-hidden">
        <img src={warehouseImage} alt="REMQUIP warehouse" className="absolute inset-0 w-full h-full object-cover scale-105 animate-slow-zoom" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px w-12 bg-accent/60" />
              <span className="font-display font-black uppercase tracking-[0.3em] text-[10px] text-accent">
                {t("about.hero.label")}
              </span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-black text-white leading-[0.95] mb-8 tracking-tighter uppercase">
              {t("about.hero.title")}
            </h1>
            <p className="text-zinc-400 text-lg sm:text-xl leading-relaxed max-w-xl font-medium">
              {t("about.hero.subtitle")}
            </p>
          </div>
        </div>
      </section>

      {/* Stats bar - High impact glassmorphism */}
      <section className="relative z-10 -mt-12 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-card/50 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/10">
          {[
            { value: "500+", labelKey: "about.stat.skus", icon: Award },
            { value: "48h", labelKey: "about.stat.delivery", icon: Zap },
            { value: "15+", labelKey: "about.stat.experience", icon: TrendingUp },
            { value: "3", labelKey: "about.stat.warehouses", icon: Globe },
          ].map(({ value, labelKey, icon: Icon }) => (
            <div key={labelKey} className="flex flex-col sm:flex-row items-center justify-center gap-4 px-6 py-8 sm:py-10 group hover:bg-white/5 transition-colors">
              <Icon className="h-6 w-6 text-accent/80 group-hover:scale-110 transition-transform" />
              <div className="text-center sm:text-left">
                <p className="text-2xl sm:text-3xl font-black text-foreground font-display leading-none mb-1">{value}</p>
                <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest">{t(labelKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Our Story - Grid focus */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div className="relative">
             <div className="absolute -top-10 -left-10 w-40 h-40 bg-accent/10 blur-[80px] rounded-full pointer-events-none" />
            <span className="font-display font-black text-accent uppercase tracking-widest text-[10px] mb-4 block">{t("about.story.label")}</span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground mb-8 leading-tight">
                {t("about.story.title")}
            </h2>
            <div className="space-y-6 text-base text-muted-foreground leading-relaxed font-medium">
              <p>{t("about.story.p1")}</p>
              <p>{t("about.story.p2")}</p>
              <p>{t("about.story.p3")}</p>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute -inset-4 bg-accent/5 rounded-[2rem] blur-2xl group-hover:bg-accent/10 transition-colors" />
            <img src={fleetImage} alt="REMQUIP fleet" className="relative w-full h-[400px] lg:h-[500px] object-cover rounded-3xl shadow-2xl transition-transform duration-700 group-hover:scale-[1.02]" loading="lazy" />
            <div className="absolute bottom-6 left-6 right-6 p-6 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-between">
                <div className="text-white">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Legacy Operations</p>
                    <p className="text-sm font-bold mt-1">Quality Assurance Division</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black">
                    <ArrowRight className="h-4 w-4" />
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values - Glowing Cards */}
      <section className="bg-zinc-950 border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_100%_0%,rgba(255,255,255,0.03),transparent_60%)] pointer-events-none" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 relative z-10">
          <div className="text-center mb-16">
            <span className="font-display font-black text-accent uppercase tracking-widest text-[10px] mb-4 block">{t("about.values.label")}</span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white">{t("about.values.title")}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {[
              { icon: Shield, titleKey: "about.value.quality.title", descKey: "about.value.quality.desc" },
              { icon: Clock, titleKey: "about.value.speed.title", descKey: "about.value.speed.desc" },
              { icon: Users, titleKey: "about.value.partnership.title", descKey: "about.value.partnership.desc" },
              { icon: Globe, titleKey: "about.value.reach.title", descKey: "about.value.reach.desc" },
            ].map(({ icon: Icon, titleKey, descKey }, i) => (
              <div key={i} className="group relative border border-white/10 rounded-3xl p-8 h-full bg-zinc-900/50 hover:bg-zinc-900 transition-all hover:border-accent/40 hover:-translate-y-2">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:bg-accent group-hover:border-accent transition-all ring-offset-zinc-950 group-hover:ring-4 group-hover:ring-accent/20">
                  <Icon className="h-6 w-6 text-white group-hover:text-black" strokeWidth={2} />
                </div>
                <h3 className="font-display text-lg font-black text-white uppercase tracking-tight mb-4">{t(titleKey)}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed font-medium">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline - Modern minimal approach */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <div className="text-center mb-20">
          <span className="font-display font-black text-accent uppercase tracking-widest text-[10px] mb-4 block">{t("about.timeline.label")}</span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground">{t("about.timeline.title")}</h2>
        </div>
        <div className="max-w-4xl mx-auto">
          {milestones.map((m, i) => (
            <div key={i} className="flex gap-8 group">
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full border-4 border-accent bg-background z-10 group-hover:scale-125 transition-transform" />
                {i < milestones.length - 1 && <div className="w-0.5 flex-1 bg-gradient-to-b from-accent to-accent/20 my-2" />}
              </div>
              <div className="pb-16 pt-0">
                <span className="font-display font-black text-accent text-lg mb-2 block">{m.icon}</span>
                <h3 className="font-display text-xl sm:text-2xl font-black uppercase tracking-tight text-foreground mb-4">{t(m.titleKey)}</h3>
                <p className="text-base text-muted-foreground font-medium leading-relaxed max-w-2xl">{t(m.descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Team - Premium cards */}
      <section className="bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center mb-16">
            <span className="font-display font-black text-accent uppercase tracking-widest text-[10px] mb-4 block">{t("about.team.label")}</span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground">{t("about.team.title")}</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-8 max-w-2xl mx-auto">
            {team.map(({ nameKey, roleKey, descKey }, i) => (
              <div key={i} className="group border border-border/60 rounded-3xl p-8 bg-card text-center hover:bg-background hover:shadow-2xl transition-all hover:border-accent/30 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-accent transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                <div className="w-20 h-20 rounded-full border-2 border-border p-1 mx-auto mb-6 group-hover:border-accent transition-colors">
                  <div className="w-full h-full rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-8 w-8 text-muted-foreground group-hover:text-accent transition-colors" />
                  </div>
                </div>
                <h3 className="font-display text-base font-black uppercase tracking-tight text-foreground">{t(nameKey)}</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent mt-2 mb-4">{t(roleKey)}</p>
                <div className="h-px w-8 bg-border mx-auto mb-4" />
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* High Contrast CTA */}
      <section className="relative overflow-hidden py-24 md:py-40">
        <img src={warehouseImage} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-primary/90 mix-blend-multiply" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="font-display text-4xl sm:text-5xl md:text-7xl font-black uppercase tracking-tighter mb-8 max-w-4xl mx-auto leading-[0.9]">{t("about.cta.title")}</h2>
          <p className="text-primary-foreground/80 text-lg sm:text-xl max-w-2xl mx-auto mb-12 font-medium leading-relaxed">{t("about.cta.desc")}</p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link to="/contact" className="group bg-white text-black px-10 py-5 rounded-2xl font-display font-black uppercase tracking-widest text-sm hover:bg-accent hover:text-white transition-all shadow-2xl flex items-center justify-center gap-3">
              {t("footer.contact")} <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/products" className="group border-2 border-white/20 text-white px-10 py-5 rounded-2xl font-display font-black uppercase tracking-widest text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-3">
              {t("banner.stock.cta")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
