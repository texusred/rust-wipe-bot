// Add this to the buildApprovalEmbed function in approvalManager.js:

// After the existing fields, add tie information if present
if (selectionData.ties && selectionData.ties.length > 0) {
    const tieText = selectionData.ties.map(tie => {
        const playerList = tie.players.map(p => `**${p.username}** (${p.priorityScore} pts)`).join(', ');
        return `${tie.position}: ${playerList}`;
    }).join('\n');
    
    embed.addFields({
        name: '⚠️ TIES DETECTED - ADMIN REVIEW REQUIRED',
        value: tieText,
        inline: false
    });
}
