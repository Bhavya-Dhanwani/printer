// Importing modules
import { Response } from "express";
import ApiResponse from "../utils/ApiResponse.util.js";
import HTTP_STATUS from "../constants/StatusCodes.constants.js";

// function to send the API response
function Accepted<T = unknown>(res: Response, message: string = "Request Accepted", data: T | null = null) {

    // sending the response with status code, message and data
    return ApiResponse(res, HTTP_STATUS.ACCEPTED, message, data);

}

export default Accepted;
