import './App.css'
import { HeroPage } from './app/HeroPage'
import { Analytics } from '@vercel/analytics/react'

function App() {
    return (
        <>
            <HeroPage />
            <Analytics />
        </>
    )
}

export default App
