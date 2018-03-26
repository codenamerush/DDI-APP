$(document).ready(function(){
    $('.from').on('click', '.grid-item', function(e){
        $('.from .grid-item.selected').removeClass('selected');
        $(e.target).closest('.grid-item').addClass("selected");
        $('input#comparisons').val(JSON.stringify({
            from: $('.from .grid-item.selected').data('id')
        }));
        $('form#compareForm').submit()
    });


    $('.to').on('click', '.grid-item', function(e){
        $(e.target).closest('.grid-item').toggleClass("selected");
    });
});