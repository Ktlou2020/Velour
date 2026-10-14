/** Keyframes for the heart burst / pop, with reduced-motion fallbacks. */
export default function ExploreStyles() {
  return (
    <style>{`
@keyframes hush-heart-burst {
  0% { transform: scale(.2); opacity: 0 }
  15% { transform: scale(1.25); opacity: 1 }
  30% { transform: scale(.92) }
  45% { transform: scale(1.05) }
  75% { transform: scale(1); opacity: 1 }
  100% { transform: scale(1.1) translateY(-14px); opacity: 0 }
}
@keyframes hush-heart-fade { 0% { opacity: 0 } 20% { opacity: 1 } 75% { opacity: 1 } 100% { opacity: 0 } }
@keyframes hush-pop { 0% { transform: scale(1) } 40% { transform: scale(1.3) } 100% { transform: scale(1) } }
.hush-heart-burst { animation: hush-heart-burst .9s cubic-bezier(.2,.8,.3,1) forwards }
.hush-pop { animation: hush-pop .35s ease-out }
@media (prefers-reduced-motion: reduce) {
  .hush-heart-burst { animation: hush-heart-fade .8s linear forwards }
  .hush-pop { animation: none }
}
.hush-no-scrollbar { scrollbar-width: none }
.hush-no-scrollbar::-webkit-scrollbar { display: none }
`}</style>
  );
}
