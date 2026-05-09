import React, { useState } from 'react'
import {FaRegEye, FaRegEyeSlash} from 'react-icons/fa6'

// ORIGINAL: const Input = ({value, onChange, label, placeholder, type}) => {
// NEW: add autoComplete prop for browser password/email autofill hints.
const Input = ({value, onChange, label, placeholder, type, autoComplete}) => {
    const [showPassword, setShowPassword] = useState(false);
    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    }
  return (
    <div>
      <label className='text-[13px] text-slate-800'>{label}</label>
      <div className='input-box'>
        <input 
          // ORIGINAL: type={type == "password" ? showPassword ? "text" : "password" : type}
          type={type === "password" ? showPassword ? "text" : "password" : type} 
            placeholder={placeholder} 
            value={value} 
            onChange={(e)=> onChange(e)}
          autoComplete={autoComplete}
            className='w-full bg-transparent outline-none'
        />
        {
          type === "password" && (
                <>
                {showPassword ?(
                    <FaRegEye size = {22} className = "text-primary cursor-pointer" onClick={()=>togglePasswordVisibility()}></FaRegEye>
                ):(
                    <FaRegEyeSlash size = {22} className = "text-slate-400 cursor-pointer" onClick={() => togglePasswordVisibility()}></FaRegEyeSlash>
                )}
                </>
        )}
      </div>
    </div>
  )
}

export default Input
