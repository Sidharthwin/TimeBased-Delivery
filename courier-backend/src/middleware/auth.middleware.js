import jwt from "jsonwebtoken";

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization ;

    if(!authHeader || !authHeader.startsWith("Bearer ")){
        return res.status(401).json({
            success: false , 
            message: "Access token missing or invalid"
        })
    }
    const token = authHeader.split(" ")[1];
    // the above helps to split "Bearers a#3*" -> ["Bearer" , "a#3*"] the above extracts the token 

    try{
        if(!process.env.JWT_SECRET){
            return res.status(500).json({
                success : false,
                message: "Internal server error"

            })
        }
        const decoded = jwt.verify(token , process.env.JWT_SECRET)
        req.user = decoded
        // see our req.user contains the login payload ,We are adding the verified user's information to the request object.
        // we do this so that We don't need to decode the token again in every route.
    }
    catch(error){
        return res.status(401).json({
            success : false,
            message: "Invalid or expired token"
        })
    }

    next()
};  



export default authenticateToken ; 