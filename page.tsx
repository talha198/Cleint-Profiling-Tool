'use client'

import { useState } from 'react'
import { Upload, TrendingUp, TrendingDown, Users, DollarSign, Download } from 'lucide-react'

interface Trade {
  clientCode: string
  client: string
  symbol: string
  quantity: number
  rate: number
  amount: number
  brokerage: number
  taxes: number
  netAmount: number
}

interface ClientSummary {
  clientCode: string
  client: string
  netProfitLoss: number
  totalBrokerage: number
  totalTaxes: number
  totalRevenue: number
  numberOfTrades: number
  status: string
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [clientSummary, setClientSummary] = useState<ClientSummary[]>([])
  const [error, setError] = useState<string>('')

  const parsePDF = async (file: File) => {
    const text = await file.text()
    const lines = text.split('\n')
    
    const parsedTrades: Trade[] = []
    let currentClient = ''
    let currentClientCode = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      const clientMatch = line.match(/^(\d{6})\s+(.+?)(\d{6,8})$/)
      if (clientMatch) {
        currentClientCode = clientMatch[1]
        currentClient = clientMatch[2].replace(/[0-9]/g, '').trim()
        continue
      }

      if (line.match(/^[A-Z][A-Z0-9\-]{1,9}\s+\d{2}-[A-Z]{3}-/)) {
        const parts = line.split(/\s+/)
        if (parts.length >= 10 && currentClient) {
          const symbol = parts[0]
          const numbers = parts.slice(4).map(p => parseFloat(p.replace(/,/g, '')) || 0)
          
          if (numbers.length >= 6) {
            parsedTrades.push({
              clientCode: currentClientCode,
              client: currentClient,
              symbol,
              quantity: Math.abs(numbers[0]),
              rate: numbers[1],
              amount: Math.abs(numbers[2]),
              brokerage: Math.abs(numbers[3]),
              taxes: Math.abs(numbers[4]),
              netAmount: numbers[5]
            })
          }
        }
      }
    }

    return parsedTrades
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return

    setFile(uploadedFile)
    setLoading(true)
    setError('')

    try {
      const parsedTrades = await parsePDF(uploadedFile)
      const clientMap = new Map<string, ClientSummary>()

      parsedTrades.forEach(trade => {
        const key = trade.clientCode
        if (!clientMap.has(key)) {
          clientMap.set(key, {
            clientCode: trade.clientCode,
            client: trade.client,
            netProfitLoss: 0,
            totalBrokerage: 0,
            totalTaxes: 0,
            totalRevenue: 0,
            numberOfTrades: 0,
            status: ''
          })
        }

        const summary = clientMap.get(key)!
        summary.netProfitLoss += trade.netAmount
        summary.totalBrokerage += trade.brokerage
        summary.totalTaxes += trade.taxes
        summary.numberOfTrades++
      })

      const summaries = Array.from(clientMap.values()).map(s => ({
        ...s,
        totalRevenue: s.totalBrokerage + s.totalTaxes,
        status: s.netProfitLoss > 0 ? 'Profit' : s.netProfitLoss < 0 ? 'Loss' : 'Breakeven'
      }))

      summaries.sort((a, b) => b.totalRevenue - a.totalRevenue)
      setClientSummary(summaries)
    } catch (err) {
      setError('Error processing file')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const downloadCSV = () => {
    const csv = [
      ['Client Code', 'Client', 'Net P&L', 'Brokerage', 'Taxes', 'Revenue', 'Trades', 'Status'],
      ...clientSummary.map(c => [
        c.clientCode,
        c.client,
        c.netProfitLoss.toFixed(2),
        c.totalBrokerage.toFixed(2),
        c.totalTaxes.toFixed(2),
        c.totalRevenue.toFixed(2),
        c.numberOfTrades,
        c.status
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'trading-analytics.csv'
    a.click()
  }

  const profitableClients = clientSummary.filter(c => c.netProfitLoss > 0)
  const lossClients = clientSummary.filter(c => c.netProfitLoss < 0)
  const totalRevenue = clientSummary.reduce((sum, c) => sum + c.totalRevenue, 0)

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            📊 Trading Analytics Portal
          </h1>
          <p className="text-gray-300 text-lg">
            Upload your PDF trading report to analyze performance
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 mb-8 border border-white/20">
          <label className="flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all rounded-xl p-8 border-2 border-dashed border-white/30">
            <Upload className="w-12 h-12 md:w-16 md:h-16 text-purple-400 mb-4" />
            <span className="text-white text-lg md:text-xl font-semibold mb-2 text-center">
              {file ? file.name : 'Click to upload PDF'}
            </span>
            <span className="text-gray-400 text-sm md:text-base">
              Microlinks Transaction Detail Report
            </span>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          
          {loading && (
            <div className="mt-4 text-center text-purple-300">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-400 border-t-transparent"></div>
              <p className="mt-2">Processing...</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
              {error}
            </div>
          )}
        </div>

        {clientSummary.length > 0 && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 md:p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-6 h-6 md:w-8 md:h-8 opacity-80" />
                  <span className="text-xl md:text-2xl font-bold">{clientSummary.length}</span>
                </div>
                <p className="text-blue-100 text-sm md:text-base">Total Clients</p>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 md:p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-6 h-6 md:w-8 md:h-8 opacity-80" />
                  <span className="text-xl md:text-2xl font-bold">{profitableClients.length}</span>
                </div>
                <p className="text-green-100 text-sm md:text-base">Profitable</p>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 md:p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <TrendingDown className="w-6 h-6 md:w-8 md:h-8 opacity-80" />
                  <span className="text-xl md:text-2xl font-bold">{lossClients.length}</span>
                </div>
                <p className="text-red-100 text-sm md:text-base">Loss-Making</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 md:p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-6 h-6 md:w-8 md:h-8 opacity-80" />
                  <span className="text-xl md:text-2xl font-bold">{(totalRevenue / 1000).toFixed(0)}K</span>
                </div>
                <p className="text-purple-100 text-sm md:text-base">Revenue PKR</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 md:p-6 border border-white/20">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h3 className="text-xl md:text-2xl font-bold text-white">Client Performance</h3>
                <button
                  onClick={downloadCSV}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors text-sm md:text-base"
                >
                  <Download className="w-4 h-4 md:w-5 md:h-5" />
                  Export CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm md:text-base">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="pb-3 text-gray-300 font-semibold">Client</th>
                      <th className="pb-3 text-gray-300 font-semibold text-right">Revenue</th>
                      <th className="pb-3 text-gray-300 font-semibold text-right">P&L</th>
                      <th className="pb-3 text-gray-300 font-semibold text-right hidden md:table-cell">Trades</th>
                      <th className="pb-3 text-gray-300 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientSummary.slice(0, 50).map((client, idx) => (
                      <tr key={idx} className="border-b border-white/10 hover:bg-white/5">
                        <td className="py-3 text-white">{client.client}</td>
                        <td className="py-3 text-right text-purple-300">
                          {(client.totalRevenue / 1000).toFixed(1)}K
                        </td>
                        <td className={`py-3 text-right font-semibold ${client.netProfitLoss > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(client.netProfitLoss / 1000).toFixed(1)}K
                        </td>
                        <td className="py-3 text-right text-gray-300 hidden md:table-cell">{client.numberOfTrades}</td>
                        <td className="py-3">
                          <span className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-semibold ${
                            client.status === 'Profit' ? 'bg-green-500/20 text-green-400' :
                            client.status === 'Loss' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {client.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
