import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Ghost } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    console.error("404 Error: Access violation at", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-background px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--accent)/0.03),transparent_60%)] pointer-events-none" />
      
      <div className="text-center relative z-10">
        <div className="flex justify-center mb-8">
            <div className="w-24 h-24 rounded-[2.5rem] bg-muted/30 border-2 border-dashed border-border flex items-center justify-center group">
                <Ghost className="h-10 w-10 text-muted-foreground group-hover:text-accent group-hover:scale-110 transition-all duration-500" />
            </div>
        </div>
        
        <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-6 bg-accent/40" />
            <span className="font-display font-black uppercase tracking-[0.3em] text-[10px] text-accent"> Error Code: 0404 </span>
            <div className="h-px w-6 bg-accent/40" />
        </div>
        
        <h1 className="font-display text-5xl sm:text-7xl font-black uppercase tracking-tighter text-foreground mb-4">
            Route Not Found
        </h1>
        <p className="mb-10 text-lg text-muted-foreground font-medium max-w-sm mx-auto">
            The requested logistics coordinate at <span className="text-foreground font-bold">{location.pathname}</span> does not exist in our manifest.
        </p>
        
        <Link to="/" className="group inline-flex items-center gap-4 bg-foreground text-background px-10 py-5 rounded-2xl font-display font-black uppercase tracking-widest text-xs hover:bg-accent transition-all shadow-xl">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Return to Hub
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
