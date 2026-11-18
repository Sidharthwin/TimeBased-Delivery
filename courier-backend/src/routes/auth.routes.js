import express from "express" ;
import prisma from "../config/database.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authenticateToken from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";


const router = express.Router() ;



router.post("/register", async (req, res) => {
    try{
        const {name , email , password} = req.body // destructured extracting

        if(typeof name != "string" || typeof email != "string" || typeof password != "string"){
            return res.status(400).json({
                success: false ,
                message: "Name, email and password are required"

            })


        }

        const normalizedEmail = email.trim().toLowerCase() // this fixes the whitespaces and lowercases the email
        const normalizedName = name.trim()

        if(!normalizedName || !normalizedEmail || !password.trim()){// this checks if it is empty or not
            return res.status(400).json({ // see we need to put return here otherwise if it gives error it might happen the code still runs
                // remember invalid input is not a missing resource so we keep 400 not 404
                success: false ,
                message: "Name, email and password are required"
            })
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long"
            });
        }
        const existingUser = await prisma.user.findUnique({
            where : {email : normalizedEmail}
        })
        if(existingUser){
            return res.status(409).json({
                success : false ,
                message : "Email already registered"
            })
        }

        const passwordHash = await bcrypt.hash(password,12)
        const newUser = await prisma.user.create({
            data : {
                name : normalizedName ,
                email : normalizedEmail,
                passwordHash: passwordHash
            }
        })


        return res.status(201).json({
            success: true ,
            message: "User registered successfully",
            user: { // here we delibaretly exclude the password
                id: newUser.id ,
                name: newUser.name,
                email: newUser.email,
                platformRole: newUser.platformRole

            }
    })}
    catch (error) { // we used try-catch to handle unexpected error
        console.error("Registration error:", error);

        if(error.code === "P2002"){// if 2 people login at same time
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            })
        }

        return res.status(500).json({//Unexpected server error
            success: false,
            message: "Internal server error"
        });

}
});

router.post("/login" , async (req,res) => { // login router
    try{
        const { email, password } = req.body;

        if(typeof email !== "string" ||typeof password !== "string" ||!email.trim() ||!password.trim()) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
    });
}

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique( // finds the email in the database
        {where : {email : normalizedEmail}}
    )
    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Invalid email or password"
    });
    }

    const passwordValid = await bcrypt.compare(password , user.passwordHash)

    if(!passwordValid){
        return res.status(401).json({
            success: false,
            message:"Invalid email or password"

        })
    }
    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET is not configured");
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }

//Prevcious implemetation we did
    // const token = jwt.sign(
    //     { // this stores info. in the payload
    //         userId : user.id ,
    //         role : user.platformRole
    //     } ,

    //     process.env.JWT_SECRET, // 	Secret key used to sign the token (secret key accessed using proccess.env it access the env through key value pair , without exposing )

    //     {
    //         expiresIn : process.env.JWT_EXPIRES_IN || "1d" //
    //     }

    // )

// this take cares for all the people
    // Fetch memberships to distinguish regular customers from deactivated agency users.
    const memberships = await prisma.agencyUser.findMany({
        where: {
            userId: user.id
        },
        select: {
            agencyId: true,
            role: true,
            isActive: true
        }
    });

    const activeMemberships = memberships.filter((membership) => membership.isActive);

    if (
        user.platformRole !== "PLATFORM_ADMIN" &&
        memberships.length > 0 &&
        activeMemberships.length === 0
    ) {
        return res.status(401).json({
            success: false,
            message: "Invalid email or password"
        });
    }

    // Building the JWT payload
    const tokenPayload = {
        userId: user.id,
        role: user.platformRole
    };

    // Adding agency context when the user has exactly one active membership
    if (activeMemberships.length === 1) {
        tokenPayload.agencyId = activeMemberships[0].agencyId;
        tokenPayload.agencyRole = activeMemberships[0].role;
    }

    // A user with multiple memberships must select an agency separately.

    const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "1d"
        }
    );
// This helps the frontend to identify which agency dashboard the user should access.
    return res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.platformRole,
        agency: activeMemberships.length === 1
            ? {
                id: activeMemberships[0].agencyId,
                role: activeMemberships[0].role
            }
            : null
    }
});

    }
    catch(error){
        console.error("Login error:", error)

        res.status(500).json({
            success : false,
            message: "Internal server error"

        })
    }

})

router.get("/me" , authenticateToken , (req,res)=>{
    return res.status(200).json({
        success: true,
        user: req.user
    })
})
router.get(
    "/admin-test",
    authenticateToken,
    authorizeRoles("PLATFORM_ADMIN"),
    (req, res) => {
        return res.json({
            success: true,
            message: "Platform Admin access granted",
            user: req.user
        });
    }
);


export default router ;
