import { AppShell } from './app/AppShell'
import { useBrewingData } from './features/brew/useBrewingData'
import './styles/index.css'
export default function App() {
  const data = useBrewingData()
  return <AppShell {...data} />
}
