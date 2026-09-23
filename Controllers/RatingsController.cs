using Microsoft.AspNetCore.Mvc;

namespace MediaPlayer.Controllers
{
    // Serves the Top Rated page, ratings load from Supabase in the browser.
    public class RatingsController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
