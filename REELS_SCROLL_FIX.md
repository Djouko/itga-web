// SIMPLIFIED reels infinite scroll logic matching Flutter mobile exactly
// File: F:\Workspace\Freelance\IT Girls\Code\chatter\19 decembre\Chatter 19 December 2025\ITGA\chatter_web\src\app\(app)\reels\page.tsx

/* Previous useEffect that had fetchReels in deps causing re-renders:

  useEffect(() => {
    if (currentIndex >= reels.length - 3 && hasMore && !isFetchingRef.current && reels.length > 0 && fetchReelsRef.current) {
      fetchReelsRef.current(reels.length);
    }
  }, [currentIndex, reels.length, hasMore]);

  PROBLEM: Too complex with refs, still had closure issues
  
  SOLUTION: Match mobile exactly - when currentIndex changes, check and fetch directly
*/

  useEffect(() => {
    if (currentIndex >= reels.length - 3 && hasMore && !isFetchingRef.current && reels.length > 0) {
      fetchReels(reels.length);
    }
  }, [currentIndex, reels.length, hasMore, fetchReels]);
  
/* This works because:
   1. fetchReels is stable (useCallback with correct deps)
   2. Direct call when index changes (like Flutter _fetchMoreData)
   3. No ref indirection needed
*/
