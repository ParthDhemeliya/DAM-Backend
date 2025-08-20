export default function FeaturesGrid() {
  return (
    <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="group text-center transform transition-all duration-300 hover:scale-105">
        <div className="bg-gradient-to-br from-blue-100 to-indigo-100 group-hover:from-blue-200 group-hover:to-indigo-200 rounded-3xl p-6 w-20 h-20 mx-auto mb-6 flex items-center justify-center transition-all duration-300 shadow-lg group-hover:shadow-xl">
          <svg
            className="h-10 w-10 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">Easy Upload</h3>
        <p className="text-gray-600 leading-relaxed">
          Drag and drop interface for quick file uploads with beautiful
          animations
        </p>
      </div>

      <div className="group text-center transform transition-all duration-300 hover:scale-105">
        <div className="bg-gradient-to-br from-green-100 to-emerald-100 group-hover:from-green-200 group-hover:to-emerald-200 rounded-3xl p-6 w-20 h-20 mx-auto mb-6 flex items-center justify-center transition-all duration-300 shadow-lg group-hover:shadow-xl">
          <svg
            className="h-10 w-10 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">Organize Files</h3>
        <p className="text-gray-600 leading-relaxed">
          Categorize and tag your assets with intelligent organization
        </p>
      </div>

      <div className="group text-center transform transition-all duration-300 hover:scale-105">
        <div className="bg-gradient-to-br from-purple-100 to-violet-100 group-hover:from-purple-200 group-hover:to-violet-200 rounded-3xl p-6 w-20 h-20 mx-auto mb-6 flex items-center justify-center transition-all duration-300 shadow-lg group-hover:shadow-xl">
          <svg
            className="h-10 w-10 text-purple-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">
          Track Analytics
        </h3>
        <p className="text-gray-600 leading-relaxed">
          Monitor usage patterns and performance metrics in real-time
        </p>
      </div>
    </div>
  )
}
