import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Speak Station — Find your speaking confidence',description:'Your daily IELTS speaking workspace. Record your answers, learn from detailed corrections, and build confidence one conversation at a time.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
