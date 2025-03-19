import express from 'express'
import mongoose from 'mongoose'
import 'dotenv/config'
import bcrypt from "bcrypt"
import User from "./Schema/User.js"
import { nanoid } from 'nanoid'
import jwt from 'jsonwebtoken';
import cors from 'cors'
import admin from "firebase-admin";
import Blog from './Schema/Blog.js'
const { credential } = admin;
import serviceAccountkey from "./react-js-blog-website-bf9c9-firebase-adminsdk-ezxo0-ae42ca2537.json" assert {type :"json"}
import {getAuth} from "firebase-admin/auth"
import Cloudinary from "cloudinary";
const { v2: cloudinary } = Cloudinary;
// cloudinary instance has been taken 

// Use `cloudinaryV2` as your Cloudinary instance
import multer from "multer";

const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ storage }); // Use memory storage for uploaded files



const server = express();
let PORT=3000;

// written this to make an request to the server
admin.initializeApp({
credential : admin.credential.cert(serviceAccountkey)
})


let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/; // regex for email
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/; // regex for password

server.use(express.json());
// allowing to make a request from frontend running on different [ort and backend on different port ]
server.use(cors());

mongoose.connect(process.env.DB_LOCATION,{
    autoIndex:true
})


const cloudinaryConnect = () => {
    try{
            cloudinary.config({
                cloud_name:process.env.CLOUD_NAME,
                api_key: process.env.API_KEY,
                api_secret: process.env.API_SECRET,
            })
            
    }
    catch(error) {
        console.log(error);
    }
}
cloudinaryConnect();

const verifyJWT = (req,res,next) =>{
const authheader = req.headers['authorization'];
console.log(authheader)
const token = authheader && authheader.split(" ")[1];

if(token==null){
return res.status(401).json({error : "no access token"})
}
jwt.verify(token,process.env.SECRET_ACCESS_KEY,(err,user)=>{
    if(err){
        return res.status(403).json({error:"access token is invalid"})
    }
    
    req.user = user.id;
    next()
})
}

const formatdatatosend=(user)=>{
    const access_token = jwt.sign({id:user._id},process.env.SECRET_ACCESS_KEY)

    return {
        access_token,
profile_img:user.personal_info.profile_img,
username:user.personal_info.username,
fullname : user.personal_info.fullname
    }
}


const generateusername = async(email) =>{
let username = email.split("@")[0];

let isusernamenotunique = await User.exists({"personal_info.username" : username}).then((result) => result)
isusernamenotunique ? username +=nanoid().substring(0,5): "";
return username;




}

server.post("/signup",(req,res)=>{
   let {fullname,email,password} = req.body;





   // validating the data from frontend 
   if(fullname.length<3){
    return res.status(403).json({"error" : "fullname must be atleast 3 letters long"})

   }
//    email length can be 0 then this below ode will run 

if(!email.length){
return res.status(403).json({"error":"enter email"})
}

if(!emailRegex.test(email)){
    return res.status(403).json({"error" : "email is invalid"})
}
if(!passwordRegex.test(password)){
return res.status(403).json({"error" : "password should be 6 to 20 characters long with a numeric,1 lowercase and uppercase letters"})
}

bcrypt.hash(password,10,async (err,hashed_password)=>{
    let username = await generateusername(email);
  let user = new User({
        personal_info:{fullname,email,password:hashed_password,username}

    })
    user.save().then((u)=>{
      
        return res.status(200).json(formatdatatosend(u))


    })
    .catch(err=>{
        if(err.code == 11000){
            return res.status(500).json("email alrady exist")
        }

        return res.status(500).json({"error" : err.message})

    })

})

})


server.post("/signin",(req,res)=>{

    let {email,password} =req.body;
    // from sign in form here we are getting email and password 
    User.findOne({"personal_info.email":email}).then((user)=>{
        if(!user){
            return res.status(403).json({"error":"email not found"})
        }
      
        if(!user.google_auth){
            bcrypt.compare(password,user.personal_info.password,(err,result)=>{
                
                    if(err){
                        return res.status(403).json({"error":"error ocurred while login please try again"})
                    
                    }
                    if(!result){
                    return res.status(403).json({"error":"incorrect password"})
                    }
                    else{
                        return res.status(200).json(formatdatatosend(user))
                    }
                    })
                    
        }else{
            return res.status(403).json({"error" :"account was creaTED USING GOOGLE"})
        }

    })
    .catch(err=>{
        console.log(err.message);
        return res.status(500).json({"error":err.message})
    })
   
})

server.post("/google-auth",async(req,res)=>{
let {access_token} =req.body;

getAuth()
.verifyIdToken(access_token)
// yaha token se user mil gya hai 
.then(async (decodeUser)=>{
let {email,name,picture } =decodeUser;
picture = picture.replace("s96-c","s384-c")

let user = await User.findOne({"personal_info.email":email}).select("personal_info.fullname personal_info.username personal_info.profile_img google_auth").then((u)=>{
    return u || null
})
.catch(err=>{
    return res.status(500).json({"error":err.message})
})

if(user){
    if(!user.google_auth){
        return res.status(403).json({"error":"this email was signed up without google. please login with password to access the account"})

    }
}

else{//signup
    let username = await generateusername(email);
    user = new User({
        personal_info : {fullname:name,email,username},
        google_auth:true
    })
    await user.save().then((u)=>{
user=u;
    })
    .catch(err=>{
        return res.status(500).json({"error":err.message})
    })
}

return res.status(200).json(formatdatatosend(user))

})
.catch(err=>{
    return res.status(500).json({"error":"failed"})
})
})



import fileUpload from "express-fileupload";
import fs from "fs";



server.use(fileUpload());

server.post("/get-upload", async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const imageFile = req.files.image;
    // Save the file temporarily
    const tempPath = `./uploads/${imageFile.name}`;
    await imageFile.mv(tempPath);

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(tempPath, {
      folder: "codehelp",
    });
    // Clean up: Delete the temporary file
    fs.unlinkSync(tempPath);

    // Respond with the Cloudinary URL
    res.status(200).json({ url: result.secure_url });
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
});


server.get('/latest-blogs', (req, res) => {
    const maxLimit = 5;
//     // blog refer kar rha hai blogs collection in mongodb here blog written because we have imported it with the name blog 

    Blog.find({ draft: false })
        .populate("author", "personal_info.profile_img personal_info.username personal_info.fullname -_id")
        .sort({ publishedAt: -1 })
        .select("blog_id title des banner activity tags publishedAt -_id")
        .limit(maxLimit)
        .then(blogs => {
            return res.status(200).json({ blogs });
        })
        .catch(err => {
            return res.status(500).json({ error: err.message });
        });
});

 
server.get("/trending-blogs" , (req,res) =>{
    Blog.find({draft:false})
    .populate("author", "personal_info.profile_img personal_info.username personal_info.fullname -_id")
    .sort({"activity.total_read" : -1, "activity.total_likes" :-1,"publishedAt" : -1})
    .select("blog_id title publishedAt -_id")
    .limit(5)
    .then(blogs =>{
        return res.status(200).json({blogs})
    })
 
})




server.post('/create-blog',verifyJWT,(req,res)=>{
  
let authorId = req.user

let {title,des,banner,tags,content,draft} = req.body;


if(!title.length){
    return res.status(403).json({error:"you must provide a title"});

}
if(!draft){

    if(!des.length || des.length > 200){
        return res.status(403).json({error:"you must provide blog description under 200 characters"});
    }
    
    
    if(!banner.length){
        return res.status(403).json({error : "you must provide blog banner to publish it"});
    
    }
    
   
    if(!content.blocks.length){
        return res.status(403).json({error: "there must be sme blog content to publish it"});
    
    }
    
    if(!tags.length || tags.length > 10){
    return res.status(403).json({error : "provide tags in order to publish the blog , Maximum 10"});
    
    }
    
}


tags = tags.map(tag => tag.toLowerCase());

let blog_id = title.replace(/[^a-zA-Z0-9]/g,' ').replace(/\s+/g, "-").trim()  + nanoid();



let blog = new Blog({
title,des,banner,content,tags,author : authorId , blog_id,draft: Boolean(draft)
})

blog.save().then(blog=>{
    let incrementVal = draft ? 0: 1;
   
User.findOneAndUpdate({_id:authorId},{$inc : {"account_info.total_posts" : incrementVal},$push : {"blogs" : blog._id}})
.then(user =>{
    return res.status(200).json({id:blog.blog_id})
})
// ab yaha jo user return hoga and return karnege wo blog ka id jo ki custom banaye the usko send karenge jo ki blogs ka db me uska schema me store kar liye the thodi na frontend me actual wala bhenjenge id 
.catch(err =>{
    return res.status(500).json({error : "failed to update total posts number"})
})


})

.catch(err =>{
    return res.status(500).json({error : err.message})
})



})

server.listen(PORT,()=>{
    console.log('listening on port -> ' + PORT);

})

