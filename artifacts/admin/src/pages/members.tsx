import React, { useState } from "react";
import { useAdminListMembers, getAdminListMembersQueryKey } from "@workspace/api-client-react";
import { Search, UserCircle, Mail, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Members() {
  const [search, setSearch] = useState("");
  const { data: members, isLoading } = useAdminListMembers({ 
    query: { queryKey: getAdminListMembersQueryKey() } 
  });

  const filteredMembers = members?.filter(m => {
    const fullName = `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase();
    const email = m.email.toLowerCase();
    const q = search.toLowerCase();
    return fullName.includes(q) || email.includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Members Directory</h1>
        <p className="text-muted-foreground mt-1">View all registered users of your gym application.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input 
          type="search" 
          placeholder="Search by name or email..." 
          className="pl-8" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-members"
        />
      </div>

      <div className="rounded-md border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">Loading members...</TableCell>
              </TableRow>
            ) : filteredMembers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No members found.
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers?.map((member) => (
                <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <UserCircle className="h-5 w-5 text-primary" />
                      </div>
                      <div className="font-medium">
                        {member.firstName || member.lastName 
                          ? `${member.firstName || ''} ${member.lastName || ''}`.trim() 
                          : 'No name provided'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 mr-1.5" />
                      {member.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="capitalize">
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm">
                      <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      {format(new Date(member.createdAt), "MMM d, yyyy")}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
