import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { auth } from "../../firebase-config";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const router = useRouter();

  // scroll state
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // auth + role check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        try {
          const token = await currentUser.getIdTokenResult(true);
          setIsAdmin(!!token.claims.admin); // expects custom claim "admin"
        } catch (err) {
          console.error("Error fetching user claims:", err);
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setIsAdmin(false);
      setIsMenuOpen(false);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleLoginClick = () => {
    setIsMenuOpen(false);
    router.push("/login");
  };

  const handleNavigation = (href) => {
    setIsMenuOpen(false);

    if (href === "/bookings") {
      if (!user) {
        router.push("/login");
      } else if (isAdmin) {
        router.push("/admin-management");
      } else {
        router.push("/bookings");
      }
    } else {
      router.push(href);
    }
  };

  const navItems = [
    { name: "Bookings", href: "/bookings" },
    { name: "Facilities", href: "/facilities" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-white/90 backdrop-blur-xl border-b border-gray-200/50 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-8 lg:px-12">
        <div className="flex items-center justify-between h-20">
          {/* Logo + title */}
          <div
            className="flex items-center space-x-3 flex-shrink-0 cursor-pointer"
            onClick={() => router.push("/")}
          >
            <img src="/file.svg" alt="Logo" className="h-10 w-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                ISBR
              </h1>
              <p className="text-sm text-gray-500 -mt-1 font-medium">
                Booking System
              </p>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <button
                key={item.name}
                onClick={() => handleNavigation(item.href)}
                className="text-base font-medium transition-all duration-300 text-gray-700 hover:text-yellow-600 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-yellow-500 after:transition-all after:duration-300 hover:after:w-full pb-1"
              >
                {item.name}
              </button>
            ))}
          </div>

          {/* Right side: login/logout */}
          <div className="flex items-center space-x-6">
            <div className="hidden md:block">
              {loading ? (
                <div className="px-4 py-2 text-sm text-gray-500 font-medium">
                  Loading...
                </div>
              ) : user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700 bg-gray-100 px-4 py-2 rounded-lg border border-gray-200">
                    {user.displayName ||
                      user.email?.split("@")[0] ||
                      "User"}
                    {isAdmin && " (Admin)"}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="px-6 py-2 text-sm font-medium transition-all duration-300 text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg shadow-md hover:shadow-lg"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLoginClick}
                  className="px-6 py-2 text-sm font-medium transition-all duration-300 text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg shadow-md hover:shadow-lg"
                >
                  Login
                </button>
              )}
            </div>

            {/* Mobile menu toggle */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 transition-all duration-300 text-gray-700 hover:text-yellow-600"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-6 pt-4 pb-6 space-y-4 bg-white/95 backdrop-blur-xl border-t border-gray-200 shadow-lg">
              {navItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  className="block w-full text-left px-4 py-3 text-base font-medium transition-all duration-300 text-gray-700 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg"
                >
                  {item.name}
                </button>
              ))}

              <div className="pt-4 border-t border-gray-200">
                {loading ? (
                  <div className="px-4 py-3 text-sm text-gray-500 font-medium">
                    Loading...
                  </div>
                ) : user ? (
                  <div className="space-y-3">
                    <div className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg border border-gray-200">
                      {user.displayName ||
                        user.email?.split("@")[0] ||
                        "User"}
                      {isAdmin && " (Admin)"}
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full px-4 py-3 text-sm font-medium transition-all duration-300 text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLoginClick}
                    className="w-full px-4 py-3 text-sm font-medium transition-all duration-300 text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg"
                  >
                    Login
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
