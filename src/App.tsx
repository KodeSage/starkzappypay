import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Pay from './pages/Pay'
import Success from './pages/Success'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pay/:address" element={<Pay />} />
        <Route path="/success/:txHash" element={<Success />} />
      </Routes>
    </BrowserRouter>
  )
}
