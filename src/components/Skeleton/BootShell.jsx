import SkeletonNavbar from './SkeletonNavbar';
import SkeletonHero from './SkeletonHero';
import SkeletonFooter from './SkeletonFooter';

export default function BootShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <SkeletonNavbar />
      {/* Mirrors App.jsx exactly: the photo is scoped to this wrapper only, so it
          starts at the navbar's bottom edge and carries on behind the transparent
          skeleton footer. */}
      <div className="site-background flex-1 flex flex-col">
        <main className="flex-1">
          <SkeletonHero />
        </main>
        <SkeletonFooter />
      </div>
    </div>
  );
}