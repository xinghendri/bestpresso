import blue from '../../assets/figma/history-blue.svg'
import green from '../../assets/figma/history-green.svg'
import purple from '../../assets/figma/history-purple.svg'

export function MiniShotChart() {
  return <div className="mini-chart" aria-label="Previous shot graph"><img src={blue} alt="" /><img src={green} alt="" /><img src={purple} alt="" /></div>
}
