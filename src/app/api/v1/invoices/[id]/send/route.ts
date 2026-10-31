import {requireActor,requireSameOrigin} from "../../../../../../server/auth/actor";
import {errorResponse} from "../../../../../../server/core/errors";
import {queueInvoice} from "../../../../../../server/notifications/service";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{requireSameOrigin(request);return Response.json({data:await queueInvoice(await requireActor(request),(await context.params).id)});}
 catch(error){return errorResponse(error);}
}
