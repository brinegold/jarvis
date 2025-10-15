'use client'

export default function TokenInfo() {
  return (
    <div className="jarvis-card rounded-2xl p-8 mb-16">
      <h3 className="text-2xl font-bold text-white mb-4">Jarvis Token Information</h3>
      <div className="grid md:grid-cols-2 gap-8 text-left">
        <div>
          <h4 className="text-lg font-semibold text-blue-400 mb-2">Current Price</h4>
          <p className="text-3xl font-bold text-white">$0.1 per Token</p>
        </div>
        <div>
          <h4 className="text-lg font-semibold text-purple-400 mb-2">Future Listing Price</h4>
          <p className="text-3xl font-bold text-white">$3.0 per Token</p>
        </div>
      </div>
      <div className="mt-6 p-4 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg">
        <p className="text-center text-white">
          🚀 <strong>Potential 30x Growth!</strong> Get in early and secure your Jarvis Tokens at the current discounted price.
        </p>
      </div>
    </div>
  )
}
