import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Auth from './pages/Auth'
import { useEffect } from 'react'
import axios from 'axios'
import { useDispatch } from 'react-redux'
import { setUserData } from './redux/userSlice'
import InterviewPage from './pages/InterviewPage'
import History from './pages/History'
import InterviewReport from './pages/InterviewReport'
import Pricing from './pages/Pricing'
import { ServerUrl } from './config/api'

function App() {

  const dispatch = useDispatch()
  useEffect(()=>{
    const getUser = async () => {
      try {
        const result = await axios.get(ServerUrl + "/api/user/current-user", {withCredentials:true})
        dispatch(setUserData(result.data))
    } catch (error) {
      console.log(error)
      dispatch(setUserData(null))
    }
  }
  getUser()

},[dispatch])

  return (
    <Routes>
      <Route path='/' element={<Home/>}/>
      <Route path ='/auth' element={<Auth />}/>
      <Route path='/interview' element={<InterviewPage />}/>
      <Route path='/history' element={<History />}/>
      <Route path='/history/:interviewId' element={<InterviewReport />}/>
      <Route path='/pricing' element={<Pricing />}/>
    </Routes>
  )
}

export default App
